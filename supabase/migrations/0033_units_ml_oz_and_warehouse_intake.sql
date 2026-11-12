-- Add millilitre + ounce to the product unit-of-measure whitelist
alter table public.products drop constraint if exists products_unit_of_measure_check;
alter table public.products add constraint products_unit_of_measure_check
  check (unit_of_measure = any (array[
    'piece','dozen','pack','set','kilogram','gram','liter','milliliter','meter','ounce'
  ]));

-- Warehouse intake: the missing "add stock" path. Writes an append-only PRODUCE
-- entry (the same entry_type seed stock uses) so on-hand updates through the ledger.
create or replace function public.warehouse_intake(p_sku uuid, p_qty integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_consignor uuid; v_new_on_hand integer;
begin
  select consignor_id into v_consignor from public.products where id = p_sku;
  if v_consignor is null then
    raise exception 'Unknown product' using errcode='check_violation';
  end if;
  if not (public.is_admin() or (public.is_consignor_user() and v_consignor = public.current_consignor_id())) then
    raise exception 'Not authorized to add stock for this product' using errcode='insufficient_privilege';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be at least 1' using errcode='check_violation';
  end if;
  insert into public.warehouse_entries (consignor_id, sku_id, entry_type, qty, ref_type, reason, actor_user_id)
  values (v_consignor, p_sku, 'PRODUCE', p_qty, 'intake', coalesce(nullif(trim(p_note), ''), 'Stock added'), auth.uid());
  select public.get_warehouse_on_hand(v_consignor, p_sku) into v_new_on_hand;
  return v_new_on_hand;
end $$;

grant execute on function public.warehouse_intake(uuid, integer, text) to authenticated;
