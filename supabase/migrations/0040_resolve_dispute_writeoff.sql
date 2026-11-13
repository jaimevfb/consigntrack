-- [DEL-10 support] Make dispute resolution clean on both outcomes.
-- v_in_dispute nets DISPUTE_HOLD + DISPUTE_RELEASE, and v_on_hand sums all entries.
--   Release: post DISPUTE_RELEASE (+qty) -> clears the dispute and returns the
--            units to sellable stock.
--   Write-off: post DISPUTE_RELEASE (+qty) to clear the dispute, THEN ADJUSTMENT
--            (-qty) to remove the written-off units -> dispute 0, units gone.
-- (Previously write-off posted nothing, so the item stayed flagged "disputed"
--  forever.)
create or replace function public.resolve_dispute(p_package_id uuid, p_sku uuid, p_qty integer, p_received boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare pk public.packages;
begin
  select * into pk from public.packages where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignee_id = public.current_store_id()) then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Nothing to resolve' using errcode = 'check_violation'; end if;

  -- clear the dispute hold either way
  insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id, reason)
  values (pk.consignee_id, p_sku, 'DISPUTE_RELEASE', p_qty, 'package', pk.id, auth.uid(),
          case when p_received then 'resolved: released to stock' else 'resolved: written off' end);

  -- write-off removes the units again (they never became sellable)
  if not p_received then
    insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id, reason)
    values (pk.consignee_id, p_sku, 'ADJUSTMENT', -p_qty, 'package', pk.id, auth.uid(), 'written off: lost/damaged at receiving');
  end if;

  update public.packages set status = 'DELIVERED', updated_at = now()
    where id = p_package_id and not exists (
      select 1 from public.package_lines where package_id = p_package_id and qty_disputed > 0 and sku_id <> p_sku);
end $function$;
