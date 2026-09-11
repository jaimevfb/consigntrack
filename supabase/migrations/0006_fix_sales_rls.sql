-- ConsignTrack — 0006 fix cross-referential RLS recursion between
-- sales and sale_items. The two SELECT policies referenced each other's
-- table, so Postgres raised "infinite recursion detected in policy" for any
-- query joining them (period sales metrics, reports, recent sales).
--
-- Fix: a SECURITY DEFINER predicate that reads both tables as the owner
-- (bypassing RLS), so neither policy re-enters the other.

create or replace function public.user_can_see_sale(p_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (select 1 from public.sales s
               where s.id = p_sale_id and s.store_id = public.current_store_id())
    or exists (select 1 from public.sale_items si
               where si.sale_id = p_sale_id and si.consignor_id = public.current_consignor_id());
$$;

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated
  using (public.user_can_see_sale(id));

drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items for select to authenticated
  using (
    public.is_admin()
    or consignor_id = public.current_consignor_id()
    or exists (select 1 from public.sales s
               where s.id = sale_id and s.store_id = public.current_store_id())
  );
