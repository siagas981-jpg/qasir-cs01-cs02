-- CS Qasir — Fase 1: Suppliers, Purchases, Weighted-Average HPP (idempotent)
-- products.cost_price IS the moving-average HPP. Adds products.last_buy_price.
-- Does NOT alter inventory/stock_movements structure.

-- 1) Expense category enum + convert existing column (expenses table already exists)
do $$ begin
  create type public.expense_category as enum ('Sewa','Gaji','Listrik','Air','Internet','Bahan Baku','Transport','Lainnya');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.expenses alter column category type public.expense_category using category::text::public.expense_category;
exception when others then
  -- if conversion fails (unexpected legacy value), leave as-is
  raise notice 'expenses.category not converted: %', sqlerrm;
end $$;

-- 2) products: moving-average HPP support
alter table public.products add column if not exists last_buy_price bigint not null default 0;

-- 3) suppliers
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  address    text,
  created_at timestamptz not null default now()
);

-- 4) purchases
create table if not exists public.purchases (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  outlet_id   uuid references public.outlets(id) on delete cascade,
  invoice_no  text,
  date        date not null default current_date,
  total_cost  bigint not null default 0,
  notes       text,
  status      text not null default 'Draft' check (status in ('Draft','Diterima','Dibatalkan')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  received_at timestamptz
);
create index if not exists purchases_outlet_idx on public.purchases(outlet_id, created_at desc);

-- 5) purchase_items
create table if not exists public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  qty         integer not null check (qty > 0),
  buy_price   bigint not null check (buy_price >= 0),
  subtotal    bigint not null default 0
);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);

-- 6) Grants + RLS (backend uses service role; RLS is a safety net for direct access)
grant usage on schema public to authenticated, anon, service_role;
grant select, insert, update, delete on public.suppliers, public.purchases, public.purchase_items to authenticated, service_role;

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

drop policy if exists suppliers_owner on public.suppliers;
create policy suppliers_owner on public.suppliers for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers for select to authenticated using (true);

drop policy if exists purchases_owner on public.purchases;
create policy purchases_owner on public.purchases for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases for select to authenticated using (public.is_owner() or outlet_id = public.my_outlet_id());

drop policy if exists pi_owner on public.purchase_items;
create policy pi_owner on public.purchase_items for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists pi_select on public.purchase_items;
create policy pi_select on public.purchase_items for select to authenticated
  using (exists (select 1 from public.purchases p where p.id = purchase_id and (public.is_owner() or p.outlet_id = public.my_outlet_id())));

-- 7) Atomic receive: weighted-average HPP + stock + ledger + status.
create or replace function public.receive_purchase(p_purchase_id uuid, p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pur     record;
  it        record;
  v_stock   integer;
  v_hpp     bigint;
  v_newstock integer;
  v_newhpp  bigint;
  v_count   integer := 0;
begin
  select * into v_pur from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_pur.status = 'Diterima' then raise exception 'ALREADY_RECEIVED' using errcode = 'P0001'; end if;

  for it in select * from public.purchase_items where purchase_id = p_purchase_id loop
    if it.product_id is null then continue; end if;
    select stock, coalesce(cost_price, 0) into v_stock, v_hpp from public.products where id = it.product_id for update;
    if not found then continue; end if;
    v_newstock := v_stock + it.qty;
    if v_newstock > 0 then
      v_newhpp := round(((v_stock::numeric * v_hpp) + (it.qty::numeric * it.buy_price)) / v_newstock);
    else
      v_newhpp := v_hpp;
    end if;
    update public.products
      set stock = v_newstock, cost_price = v_newhpp, last_buy_price = it.buy_price
      where id = it.product_id;
    insert into public.stock_movements(product_id, type, quantity, previous_stock, new_stock, notes, created_by)
      values (it.product_id, 'purchase', it.qty, v_stock, v_newstock,
              coalesce('PO ' || v_pur.invoice_no, 'Pembelian'), p_actor);
    v_count := v_count + 1;
  end loop;

  update public.purchases set status = 'Diterima', received_at = now() where id = p_purchase_id;
  return jsonb_build_object('ok', true, 'purchase_id', p_purchase_id, 'items_applied', v_count);
end $$;
grant execute on function public.receive_purchase(uuid, uuid) to service_role, authenticated;
