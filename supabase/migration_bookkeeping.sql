-- CS Qasir — Bookkeeping: expenses table (idempotent, safe to re-run)
-- Does NOT touch inventory/products/transactions. Only adds `expenses`.

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid references public.outlets(id) on delete cascade,
  date        date not null default current_date,
  category    text not null,
  amount      bigint not null check (amount >= 0),
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_outlet_date_idx on public.expenses(outlet_id, date desc);

-- Grants (RLS still restricts rows)
grant usage on schema public to authenticated, anon, service_role;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expenses to service_role;

-- RLS: owner sees/writes all; cashier/manager may read own outlet
alter table public.expenses enable row level security;
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (public.is_owner() or outlet_id = public.my_outlet_id());
drop policy if exists expenses_owner_write on public.expenses;
create policy expenses_owner_write on public.expenses for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
