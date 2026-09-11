-- ConsignTrack — 0003 Row-Level Security
-- Access is enforced HERE, in the database. The UI is never trusted.
--   admin            : everything
--   consignor        : only rows for their consignor_id (across all stores)
--   store_manager    : their store_id, incl. prices/commissions/agreements
--   store_staff      : their store_id, but NOT prices/commissions/agreements
-- Helper predicates (is_admin(), current_consignor_id(), ...) live in 0002.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.consignors        enable row level security;
alter table public.stores            enable row level security;
alter table public.app_users         enable row level security;
alter table public.agreements        enable row level security;
alter table public.products          enable row level security;
alter table public.deliveries        enable row level security;
alter table public.delivery_items    enable row level security;
alter table public.stock_levels      enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_items        enable row level security;
alter table public.returns           enable row level security;
alter table public.settlements       enable row level security;
alter table public.settlement_lines  enable row level security;
alter table public.payments          enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.audit_log         enable row level security;

-- ---------------------------------------------------------------------------
-- consignors
-- ---------------------------------------------------------------------------
create policy consignors_select on public.consignors for select to authenticated
  using (
    public.is_admin()
    or id = public.current_consignor_id()
    or exists (select 1 from public.agreements a
               where a.consignor_id = consignors.id and a.store_id = public.current_store_id())
  );
create policy consignors_insert on public.consignors for insert to authenticated
  with check (public.is_admin());
create policy consignors_update on public.consignors for update to authenticated
  using (public.is_admin() or id = public.current_consignor_id())
  with check (public.is_admin() or id = public.current_consignor_id());
create policy consignors_delete on public.consignors for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
create policy stores_select on public.stores for select to authenticated
  using (
    public.is_admin()
    or id = public.current_store_id()
    or exists (select 1 from public.agreements a
               where a.store_id = stores.id and a.consignor_id = public.current_consignor_id())
  );
create policy stores_insert on public.stores for insert to authenticated
  with check (public.is_admin());
create policy stores_update on public.stores for update to authenticated
  using (public.is_admin() or (public.is_store_manager_or_admin() and id = public.current_store_id()))
  with check (public.is_admin() or (public.is_store_manager_or_admin() and id = public.current_store_id()));
create policy stores_delete on public.stores for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- app_users — you can see yourself; managers/consignors see their own scope
-- ---------------------------------------------------------------------------
create policy app_users_select on public.app_users for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.is_admin()
    or (public.is_store_user() and store_id = public.current_store_id())
    or (public.is_consignor_user() and consignor_id = public.current_consignor_id())
  );
create policy app_users_write on public.app_users for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- agreements — commissions/agreements are store_manager/admin territory (BR8)
-- ---------------------------------------------------------------------------
create policy agreements_select on public.agreements for select to authenticated
  using (
    public.is_admin()
    or consignor_id = public.current_consignor_id()
    or store_id = public.current_store_id()
  );
create policy agreements_write on public.agreements for all to authenticated
  using (public.is_admin() or (public.is_store_manager_or_admin() and store_id = public.current_store_id()))
  with check (public.is_admin() or (public.is_store_manager_or_admin() and store_id = public.current_store_id()));

-- ---------------------------------------------------------------------------
-- products — owned by the consignor; stores read the catalogue they carry
-- ---------------------------------------------------------------------------
create policy products_select on public.products for select to authenticated
  using (
    public.is_admin()
    or consignor_id = public.current_consignor_id()
    or exists (select 1 from public.agreements a
               where a.consignor_id = products.consignor_id and a.store_id = public.current_store_id())
  );
create policy products_write on public.products for all to authenticated
  using (public.is_admin() or consignor_id = public.current_consignor_id())
  with check (public.is_admin() or consignor_id = public.current_consignor_id());

-- ---------------------------------------------------------------------------
-- deliveries — consignor drafts/sends; store confirms (BR4)
-- ---------------------------------------------------------------------------
create policy deliveries_select on public.deliveries for select to authenticated
  using (
    public.is_admin()
    or consignor_id = public.current_consignor_id()
    or store_id = public.current_store_id()
  );
create policy deliveries_insert on public.deliveries for insert to authenticated
  with check (public.is_admin() or (public.is_consignor_user() and consignor_id = public.current_consignor_id()));
create policy deliveries_update on public.deliveries for update to authenticated
  using (
    public.is_admin()
    or (public.is_consignor_user() and consignor_id = public.current_consignor_id())
    or (public.is_store_user() and store_id = public.current_store_id())
  )
  with check (
    public.is_admin()
    or (public.is_consignor_user() and consignor_id = public.current_consignor_id())
    or (public.is_store_user() and store_id = public.current_store_id())
  );
create policy deliveries_delete on public.deliveries for delete to authenticated
  using (public.is_admin() or (public.is_consignor_user() and consignor_id = public.current_consignor_id()));

-- ---------------------------------------------------------------------------
-- delivery_items — follow the parent delivery
-- ---------------------------------------------------------------------------
create policy delivery_items_select on public.delivery_items for select to authenticated
  using (exists (select 1 from public.deliveries d where d.id = delivery_id and (
    public.is_admin() or d.consignor_id = public.current_consignor_id() or d.store_id = public.current_store_id()
  )));
create policy delivery_items_write on public.delivery_items for all to authenticated
  using (exists (select 1 from public.deliveries d where d.id = delivery_id and (
    public.is_admin() or d.consignor_id = public.current_consignor_id()
  )))
  with check (exists (select 1 from public.deliveries d where d.id = delivery_id and (
    public.is_admin() or d.consignor_id = public.current_consignor_id()
  )));

-- ---------------------------------------------------------------------------
-- stock_levels — read-only to users; only the definer trigger writes it
-- ---------------------------------------------------------------------------
create policy stock_levels_select on public.stock_levels for select to authenticated
  using (
    public.is_admin()
    or consignor_id = public.current_consignor_id()
    or store_id = public.current_store_id()
  );

-- ---------------------------------------------------------------------------
-- sales / sale_items — recorded by store users; visible to the owning consignor
-- ---------------------------------------------------------------------------
create policy sales_select on public.sales for select to authenticated
  using (
    public.is_admin()
    or store_id = public.current_store_id()
    or exists (select 1 from public.sale_items si
               where si.sale_id = sales.id and si.consignor_id = public.current_consignor_id())
  );
create policy sales_insert on public.sales for insert to authenticated
  with check (public.is_admin() or (public.is_store_user() and store_id = public.current_store_id()));

create policy sale_items_select on public.sale_items for select to authenticated
  using (
    consignor_id = public.current_consignor_id()
    or exists (select 1 from public.sales sa where sa.id = sale_id and (
      public.is_admin() or sa.store_id = public.current_store_id()
    ))
  );
create policy sale_items_insert on public.sale_items for insert to authenticated
  with check (exists (select 1 from public.sales sa where sa.id = sale_id and (
    public.is_admin() or (public.is_store_user() and sa.store_id = public.current_store_id())
  )));

-- ---------------------------------------------------------------------------
-- returns
-- ---------------------------------------------------------------------------
create policy returns_select on public.returns for select to authenticated
  using (
    public.is_admin()
    or store_id = public.current_store_id()
    or consignor_id = public.current_consignor_id()
  );
create policy returns_insert on public.returns for insert to authenticated
  with check (public.is_admin() or (public.is_store_user() and store_id = public.current_store_id()));

-- ---------------------------------------------------------------------------
-- settlements — generated/paid by store_manager/admin; confirmed by consignor
-- ---------------------------------------------------------------------------
create policy settlements_select on public.settlements for select to authenticated
  using (exists (select 1 from public.agreements a where a.id = agreement_id and (
    public.is_admin() or a.consignor_id = public.current_consignor_id() or a.store_id = public.current_store_id()
  )));
create policy settlements_insert on public.settlements for insert to authenticated
  with check (exists (select 1 from public.agreements a where a.id = agreement_id and (
    public.is_admin() or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
  )));
create policy settlements_update on public.settlements for update to authenticated
  using (exists (select 1 from public.agreements a where a.id = agreement_id and (
    public.is_admin()
    or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
    or (public.is_consignor_user() and a.consignor_id = public.current_consignor_id())
  )))
  with check (exists (select 1 from public.agreements a where a.id = agreement_id and (
    public.is_admin()
    or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
    or (public.is_consignor_user() and a.consignor_id = public.current_consignor_id())
  )));
create policy settlements_delete on public.settlements for delete to authenticated
  using (exists (select 1 from public.agreements a where a.id = agreement_id and (
    public.is_admin() or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
  )));

-- ---------------------------------------------------------------------------
-- settlement_lines — follow the parent settlement/agreement
-- ---------------------------------------------------------------------------
create policy settlement_lines_select on public.settlement_lines for select to authenticated
  using (exists (
    select 1 from public.settlements s join public.agreements a on a.id = s.agreement_id
    where s.id = settlement_id and (
      public.is_admin() or a.consignor_id = public.current_consignor_id() or a.store_id = public.current_store_id()
    )));
create policy settlement_lines_write on public.settlement_lines for all to authenticated
  using (exists (
    select 1 from public.settlements s join public.agreements a on a.id = s.agreement_id
    where s.id = settlement_id and (
      public.is_admin() or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
    )))
  with check (exists (
    select 1 from public.settlements s join public.agreements a on a.id = s.agreement_id
    where s.id = settlement_id and (
      public.is_admin() or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
    )));

-- ---------------------------------------------------------------------------
-- payments — store sets paid_at, consignor sets confirmed_at (BR7)
-- ---------------------------------------------------------------------------
create policy payments_select on public.payments for select to authenticated
  using (exists (
    select 1 from public.settlements s join public.agreements a on a.id = s.agreement_id
    where s.id = settlement_id and (
      public.is_admin() or a.consignor_id = public.current_consignor_id() or a.store_id = public.current_store_id()
    )));
create policy payments_write on public.payments for all to authenticated
  using (exists (
    select 1 from public.settlements s join public.agreements a on a.id = s.agreement_id
    where s.id = settlement_id and (
      public.is_admin()
      or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
      or (public.is_consignor_user() and a.consignor_id = public.current_consignor_id())
    )))
  with check (exists (
    select 1 from public.settlements s join public.agreements a on a.id = s.agreement_id
    where s.id = settlement_id and (
      public.is_admin()
      or (public.is_store_manager_or_admin() and a.store_id = public.current_store_id())
      or (public.is_consignor_user() and a.consignor_id = public.current_consignor_id())
    )));

-- ---------------------------------------------------------------------------
-- stock_movements — append-only; scoped read; scoped insert; no update/delete
-- ---------------------------------------------------------------------------
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (
    public.is_admin()
    or consignor_id = public.current_consignor_id()
    or store_id = public.current_store_id()
  );
create policy stock_movements_insert on public.stock_movements for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_store_user() and store_id = public.current_store_id())
    or (public.is_consignor_user() and consignor_id = public.current_consignor_id())
  );

-- ---------------------------------------------------------------------------
-- audit_log — written by definer triggers; readable by admin
-- ---------------------------------------------------------------------------
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Privileges: authenticated may touch tables/functions, but RLS decides rows.
-- (service_role bypasses RLS and is used only by seed/verify scripts.)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
