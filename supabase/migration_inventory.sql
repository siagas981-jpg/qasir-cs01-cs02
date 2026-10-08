-- CS Qasir — Inventory / Stock Movements migration (AUTHORITATIVE, idempotent)
-- Paste into Supabase → SQL Editor → Run. Safe to re-run. Does NOT delete products/transactions.
-- This version is self-healing: it removes any prior/partial inventory objects and installs
-- the exact definitions the app expects (prevents double-deduction & signature mismatches).

-- 1) Product inventory fields (Current Stock already exists as products.stock)
alter table public.products add column if not exists min_stock  integer not null default 0;
alter table public.products add column if not exists cost_price bigint  not null default 0;

-- 2) Stock movements ledger
create table if not exists public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  type           text not null check (type in ('sale','purchase','adjustment','return')),
  quantity       integer not null,           -- positive = stock in, negative = stock out
  previous_stock integer not null,
  new_stock      integer not null,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at desc);
create index if not exists stock_movements_type_idx    on public.stock_movements(type);

-- FK to profiles so PostgREST can embed the creator (idempotent; NOT VALID skips legacy-row checks).
-- Applied via ALTER because the table may already exist from an earlier run (create-if-not-exists is a no-op then).
alter table public.stock_movements drop constraint if exists stock_movements_created_by_profiles_fkey;
alter table public.stock_movements
  add constraint stock_movements_created_by_profiles_fkey
  foreign key (created_by) references public.profiles(id) on delete set null not valid;

grant usage on schema public to authenticated, anon, service_role;
grant select on public.stock_movements to authenticated;
grant select, insert, update, delete on public.stock_movements to service_role;

-- 4) RLS — same visibility as products (owner sees all; cashier sees own outlet)
alter table public.stock_movements enable row level security;
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (public.is_owner() or p.outlet_id = public.my_outlet_id())
  ));
drop policy if exists stock_movements_owner_write on public.stock_movements;
create policy stock_movements_owner_write on public.stock_movements for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- 5) Drop ANY existing record_stock_movement overloads (removes stale/no-op versions)
do $$
declare f record;
begin
  for f in
    select oid::regprocedure as sig from pg_proc
    where proname = 'record_stock_movement' and pronamespace = 'public'::regnamespace
  loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end $$;

-- Manual stock movement RPC — atomic: locks product row, updates stock, logs movement
create function public.record_stock_movement(
  p_product_id uuid, p_type text, p_delta integer, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_prod record;
  v_prev integer;
  v_new  integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_type not in ('sale','purchase','adjustment','return') then
    raise exception 'INVALID_TYPE' using errcode = 'P0001';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'ZERO_DELTA' using errcode = 'P0001';
  end if;

  select id, stock, outlet_id into v_prod from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001'; end if;
  if not (public.is_owner() or v_prod.outlet_id = public.my_outlet_id()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_prev := v_prod.stock;
  v_new  := v_prev + p_delta;
  if v_new < 0 then raise exception 'NEGATIVE_STOCK' using errcode = 'P0001'; end if;

  update public.products set stock = v_new where id = p_product_id;
  insert into public.stock_movements(product_id, type, quantity, previous_stock, new_stock, notes, created_by)
    values (p_product_id, p_type, p_delta, v_prev, v_new, p_notes, v_uid);

  return jsonb_build_object('product_id', p_product_id, 'previous_stock', v_prev,
                            'new_stock', v_new, 'type', p_type);
end $$;
revoke all on function public.record_stock_movement(uuid, text, integer, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, integer, text) to authenticated;

-- 6) Sale deduction: remove ALL prior non-internal triggers on transaction_items so exactly
--    ONE sale trigger owns stock deduction (prevents double-decrement), then install ours.
do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
    where tgrelid = 'public.transaction_items'::regclass and not tgisinternal
  loop
    execute format('drop trigger if exists %I on public.transaction_items', t.tgname);
  end loop;
end $$;

create or replace function public.tg_transaction_item_sale() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prev integer;
  v_new  integer;
begin
  select stock into v_prev from public.products where id = NEW.product_id for update;
  if v_prev is null then return NEW; end if;  -- product removed; nothing to deduct
  v_new := v_prev - NEW.qty;
  update public.products set stock = v_new where id = NEW.product_id;
  insert into public.stock_movements(product_id, type, quantity, previous_stock, new_stock, notes, created_by)
    values (NEW.product_id, 'sale', -NEW.qty, v_prev, v_new,
            'Penjualan #' || left(NEW.transaction_id::text, 8), auth.uid());
  return NEW;
end $$;

create trigger on_transaction_item_sale after insert on public.transaction_items
  for each row execute function public.tg_transaction_item_sale();

-- 7) Recreate checkout WITHOUT inline stock deduction — the trigger above now owns it.
drop function if exists public.checkout(uuid, jsonb, bigint, uuid);
create function public.checkout(
  p_outlet_id uuid, p_items jsonb, p_paid bigint, p_client_ref uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_outlet uuid;
  v_total bigint := 0;
  v_tx_id uuid;
  v_existing record;
  v_item record;
  v_prod record;
  v_short jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select role, outlet_id into v_role, v_outlet from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'NO_PROFILE' using errcode = '42501';
  end if;
  if v_role = 'cashier' and (v_outlet is null or v_outlet <> p_outlet_id) then
    raise exception 'FORBIDDEN_OUTLET' using errcode = '42501',
      detail = 'Cashiers can only sell at their assigned outlet';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;
  if p_paid is null or p_paid < 0 then
    raise exception 'INVALID_PAYMENT' using errcode = 'P0001';
  end if;

  if p_client_ref is not null then
    perform pg_advisory_xact_lock(hashtext(p_client_ref::text));
    select id, total, paid, change into v_existing from public.transactions where client_ref = p_client_ref;
    if found then
      return jsonb_build_object('transaction_id', v_existing.id, 'total', v_existing.total,
        'paid', v_existing.paid, 'change', v_existing.change, 'duplicate', true);
    end if;
  end if;

  create temp table if not exists _cart (product_id uuid primary key, qty integer, price bigint, name text) on commit drop;
  truncate _cart;

  for v_item in
    select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::integer)::integer as qty
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if v_item.product_id is null or v_item.qty is null or v_item.qty <= 0 then
      raise exception 'INVALID_QTY' using errcode = 'P0001';
    end if;

    select id, name, price, stock, outlet_id into v_prod
      from public.products where id = v_item.product_id for update;

    if not found or v_prod.outlet_id <> p_outlet_id then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001', detail = v_item.product_id::text;
    end if;

    if v_prod.stock < v_item.qty then
      v_short := v_short || jsonb_build_object('product_id', v_prod.id, 'name', v_prod.name,
        'requested', v_item.qty, 'available', v_prod.stock);
    end if;

    insert into _cart values (v_prod.id, v_item.qty, v_prod.price, v_prod.name);
    v_total := v_total + v_prod.price * v_item.qty;
  end loop;

  if jsonb_array_length(v_short) > 0 then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001', detail = v_short::text;
  end if;

  if p_paid < v_total then
    raise exception 'INSUFFICIENT_PAYMENT' using errcode = 'P0001',
      detail = json_build_object('total', v_total, 'paid', p_paid)::text;
  end if;

  insert into public.transactions (outlet_id, cashier_id, total, paid, change, client_ref)
    values (p_outlet_id, v_uid, v_total, p_paid, p_paid - v_total, p_client_ref)
    returning id into v_tx_id;

  -- Inserting items fires tg_transaction_item_sale(), which deducts stock and logs 'sale' movements.
  insert into public.transaction_items (transaction_id, product_id, product_name, qty, price_each)
    select v_tx_id, product_id, name, qty, price from _cart;

  return jsonb_build_object('transaction_id', v_tx_id, 'total', v_total, 'paid', p_paid,
    'change', p_paid - v_total, 'duplicate', false);
end $$;

revoke all on function public.checkout(uuid, jsonb, bigint, uuid) from public, anon;
grant execute on function public.checkout(uuid, jsonb, bigint, uuid) to authenticated;
