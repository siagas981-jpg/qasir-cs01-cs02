-- CS Qasir — API grants (RLS still decides which ROWS each user sees)
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;

grant select on public.outlets to anon;
grant select, insert, update, delete on public.outlets to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.transactions to authenticated;
grant select on public.transaction_items to authenticated;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.my_outlet_id() to authenticated;
grant execute on function public.checkout(uuid, jsonb, bigint, uuid) to authenticated;
