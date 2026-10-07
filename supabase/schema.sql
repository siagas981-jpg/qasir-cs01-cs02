-- CS Qasir — full schema, RLS, signup trigger, atomic checkout RPC
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.

create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────
create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'cashier' check (role in ('owner','cashier')),
  outlet_id uuid references public.outlets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  name text not null,
  sku text,
  price bigint not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);
create index if not exists products_outlet_idx on public.products(outlet_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  total bigint not null check (total >= 0),
  paid bigint not null check (paid >= 0),
  change bigint not null check (change >= 0),
  client_ref uuid unique,
  created_at timestamptz not null default now(),
  check (paid >= total)
);
create index if not exists transactions_outlet_idx on public.transactions(outlet_id, created_at desc);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  qty integer not null check (qty > 0),
  price_each bigint not null check (price_each >= 0)
);
create index if not exists transaction_items_tx_idx on public.transaction_items(transaction_id);

-- ───────────── Helpers (security definer → no RLS recursion) ─────────────
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_outlet_id() returns uuid
language sql stable security definer set search_path = public as $$
  select outlet_id from public.profiles where id = auth.uid()
$$;

-- ───────────── Signup trigger: every new user starts as cashier, no outlet ─────────────
-- (Role is NEVER taken from client metadata — prevents self-promotion to owner.)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, outlet_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'cashier', null)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── RLS ─────────────
alter table public.outlets enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

-- outlets
drop policy if exists outlets_select on public.outlets;
create policy outlets_select on public.outlets for select to authenticated
  using (public.is_owner() or id = public.my_outlet_id());
drop policy if exists outlets_owner_write on public.outlets;
create policy outlets_owner_write on public.outlets for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_owner());
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- products (cashiers read their outlet; stock changes for cashiers only via checkout RPC)
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
  using (public.is_owner() or outlet_id = public.my_outlet_id());
drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- transactions (read-only via API; inserts only through checkout RPC)
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select to authenticated
  using (public.is_owner() or outlet_id = public.my_outlet_id());

drop policy if exists transaction_items_select on public.transaction_items;
create policy transaction_items_select on public.transaction_items for select to authenticated
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and (public.is_owner() or t.outlet_id = public.my_outlet_id())
  ));

-- ───────────── Atomic checkout ─────────────
-- p_items: [{"product_id": "<uuid>", "qty": 2}, ...]  — prices are read from DB, never trusted from client.
-- p_client_ref: idempotency key (offline queue retries return the original sale instead of double-charging).
drop function if exists public.checkout(uuid, jsonb, bigint, uuid);
create or replace function public.checkout(
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

  -- lock rows in id order (deadlock-safe), validate stock for every line
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

  insert into public.transaction_items (transaction_id, product_id, product_name, qty, price_each)
    select v_tx_id, product_id, name, qty, price from _cart;

  update public.products p set stock = p.stock - c.qty from _cart c where p.id = c.product_id;

  return jsonb_build_object('transaction_id', v_tx_id, 'total', v_total, 'paid', p_paid,
    'change', p_paid - v_total, 'duplicate', false);
end $$;

revoke all on function public.checkout(uuid, jsonb, bigint, uuid) from public, anon;
grant execute on function public.checkout(uuid, jsonb, bigint, uuid) to authenticated;
revoke all on function public.is_owner() from anon;
revoke all on function public.my_outlet_id() from anon;

-- ───────────── Manual owner seeding (if you create the owner in Auth dashboard) ─────────────
-- update public.profiles set role = 'owner', outlet_id = null where email = 'you@example.com';
