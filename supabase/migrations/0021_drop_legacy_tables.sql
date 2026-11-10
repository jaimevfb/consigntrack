-- Drop the legacy unit-serialization + quantity-ledger tables, fully replaced by
-- packages/package_lines + ledger_entries + warehouse_entries. No code reads them.
drop table if exists public.scan_events cascade;
drop table if exists public.disputes cascade;
drop table if exists public.exceptions cascade;
drop table if exists public.delivery_items cascade;
drop table if exists public.deliveries cascade;
drop table if exists public.returns cascade;
drop table if exists public.sale_items cascade;
drop table if exists public.sales cascade;
drop table if exists public.stock_levels cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.items cascade;
drop function if exists public.create_delivery_items(uuid, uuid, date, jsonb) cascade;
drop function if exists public.confirm_delivery(uuid) cascade;
drop function if exists public.record_sale(uuid, jsonb) cascade;
drop function if exists public.record_return(uuid, uuid, uuid, integer, text, date) cascade;
drop function if exists public.reconcile_stock() cascade;
drop function if exists public.forbid_movement_mutation() cascade;
