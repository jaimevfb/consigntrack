-- ConsignTrack — 0005 demo reset helper
-- Lets the seed script wipe all business data and start clean. SECURITY
-- DEFINER + service_role-only so it can never be called from the app.

create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    public.stock_movements,
    public.stock_levels,
    public.settlement_lines,
    public.payments,
    public.settlements,
    public.sale_items,
    public.sales,
    public.returns,
    public.delivery_items,
    public.deliveries,
    public.products,
    public.agreements,
    public.audit_log,
    public.app_users,
    public.consignors,
    public.stores
  restart identity cascade;
end;
$$;

revoke execute on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.reset_demo() to service_role;
