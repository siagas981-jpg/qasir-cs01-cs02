-- CS Qasir — employees migration: is_active flag, manager/admin roles, inactive-account guards
alter table public.profiles add column if not exists is_active boolean not null default true;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner','admin','manager','cashier'));

-- owner/admin must also be active
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin') and is_active from public.profiles where id = auth.uid()), false)
$$;

-- block checkout for deactivated accounts
create or replace function public.checkout(
  p_outlet_id uuid, p_items jsonb, p_paid bigint, p_client_ref uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_active boolean;
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

  select role, is_active, outlet_id into v_role, v_active, v_outlet from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'NO_PROFILE' using errcode = '42501';
  end if;
  if not v_active then
    raise exception 'ACCOUNT_INACTIVE' using errcode = '42501',
      detail = 'Akun dinonaktifkan. Hubungi owner.';
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

  insert into public.transaction_items (transaction_id, product_id, product_name, qty, price_each)
    select v_tx_id, product_id, name, qty, price from _cart;

  update public.products p set stock = p.stock - c.qty from _cart c where p.id = c.product_id;

  return jsonb_build_object('transaction_id', v_tx_id, 'total', v_total, 'paid', p_paid,
    'change', p_paid - v_total, 'duplicate', false);
end $$;

grant execute on function public.checkout(uuid, jsonb, bigint, uuid) to authenticated;
grant execute on function public.is_owner() to authenticated;
