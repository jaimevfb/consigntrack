-- Covering indexes for unindexed foreign keys (fixes seq-scan lag on joins/filters)
create index if not exists idx_app_users_consignor_id on public.app_users (consignor_id);
create index if not exists idx_app_users_store_id on public.app_users (store_id);
create index if not exists idx_audit_log_changed_by on public.audit_log (changed_by);
create index if not exists idx_commission_overrides_product_id on public.commission_overrides (product_id);
create index if not exists idx_ledger_entries_actor_user_id on public.ledger_entries (actor_user_id);
create index if not exists idx_ledger_entries_sku_id on public.ledger_entries (sku_id);
create index if not exists idx_package_lines_sku_id on public.package_lines (sku_id);
create index if not exists idx_packages_consignee_id on public.packages (consignee_id);
create index if not exists idx_packages_consignor_id on public.packages (consignor_id);
create index if not exists idx_packages_created_by on public.packages (created_by);
create index if not exists idx_settlement_lines_product_id on public.settlement_lines (product_id);
create index if not exists idx_warehouse_entries_actor_user_id on public.warehouse_entries (actor_user_id);
create index if not exists idx_warehouse_entries_sku_id on public.warehouse_entries (sku_id);

-- RLS init-plan: evaluate auth.uid() once per query instead of once per row.
-- app_users is read on every authenticated request (profile resolution), so this is hot.
drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
  for select
  using (
    (auth_user_id = (select auth.uid()))
    or is_admin()
    or (is_store_user() and (store_id = current_store_id()))
    or (is_consignor_user() and (consignor_id = current_consignor_id()))
  );
