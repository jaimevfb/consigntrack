-- At receiving, a disputed line can now carry the scanned barcodes of the exact
-- damaged/disputed items (p_lines[].codes). Record them on the DISPUTE_HOLD
-- entry's reason so the specific items are identifiable when the dispute is
-- processed later.
create or replace function public.receive_package(p_package_id uuid, p_lines jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare pk public.packages; v_line jsonb; pl public.package_lines; v_disputed boolean := false; v_reason text;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignee_id = public.current_store_id()) then
    raise exception 'Wrong destination — this package is not for your store' using errcode='insufficient_privilege';
  end if;
  if pk.status <> 'IN_TRANSIT' then
    raise exception 'Only an IN_TRANSIT package can be received (is %)', pk.status using errcode='check_violation';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into pl from public.package_lines where id=(v_line->>'line_id')::uuid and package_id=p_package_id;
    if not found then continue; end if;
    update public.package_lines
      set qty_received=(v_line->>'qty_received')::int,
          qty_disputed=coalesce((v_line->>'qty_disputed')::int,0),
          dispute_photo_url=v_line->>'photo'
      where id=pl.id;
    if coalesce((v_line->>'qty_received')::int,0) > 0 then
      insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
      values (pk.consignee_id, pl.sku_id, 'RECEIVE', (v_line->>'qty_received')::int, 'package', pk.id, auth.uid());
    end if;
    if coalesce((v_line->>'qty_disputed')::int,0) > 0 then
      v_disputed := true;
      v_reason := 'discrepancy at receiving';
      if jsonb_typeof(v_line->'codes') = 'array' and jsonb_array_length(v_line->'codes') > 0 then
        v_reason := v_reason || ' · scanned: ' || (select string_agg(x, ', ') from jsonb_array_elements_text(v_line->'codes') as x);
      end if;
      insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id, reason)
      values (pk.consignee_id, pl.sku_id, 'DISPUTE_HOLD', -(v_line->>'qty_disputed')::int, 'package', pk.id, auth.uid(), v_reason);
    end if;
  end loop;
  update public.packages set status = case when v_disputed then 'PARTIAL_DISPUTED' else 'DELIVERED' end, updated_at=now() where id=p_package_id;
  return case when v_disputed then 'PARTIAL_DISPUTED' else 'DELIVERED' end;
end $function$;
