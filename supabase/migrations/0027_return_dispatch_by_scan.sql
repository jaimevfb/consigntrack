-- 0027: returns mirror the outbound flow.
-- Before: building a return jumped straight to RETURN_IN_TRANSIT and removed the
-- store's stock immediately. Now a return is BUILT as RETURN_PACKED (nothing
-- moves), and only a scan of its QR dispatches it — posting the RETURN_OUT
-- ledger entries and flipping it to RETURN_IN_TRANSIT. The consignor then scans
-- to receive it into the warehouse, exactly as deliveries work.

create or replace function public.build_return_package(p_consignor uuid, p_consignee uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_pkg uuid; v_line jsonb; v_sku uuid; v_qty int; v_onhand int;
begin
  if not (public.is_admin() or p_consignee = public.current_store_id()) then
    raise exception 'Not authorized to build returns for this store' using errcode='insufficient_privilege';
  end if;
  insert into public.packages (pkg_code, direction, consignor_id, consignee_id, status, created_by)
  values (public.gen_pkg_code('RETURN'), 'RETURN', p_consignor, p_consignee, 'RETURN_PACKED', auth.uid())
  returning id into v_pkg;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := (v_line->>'sku_id')::uuid; v_qty := (v_line->>'qty')::int;
    v_onhand := public.get_on_hand(p_consignee, v_sku);
    if v_qty <= 0 or v_qty > v_onhand then
      raise exception 'Return qty for % must be 1..% (on hand)', (select sku from public.products where id=v_sku), v_onhand using errcode='check_violation';
    end if;
    insert into public.package_lines (package_id, sku_id, qty_expected) values (v_pkg, v_sku, v_qty);
    -- NOTE: stock leaves on dispatch (scan), not at build time.
  end loop;
  return v_pkg;
end $function$;

create or replace function public.dispatch_return_package(p_package_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare pk public.packages; pl record; v_oh int;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignee_id = public.current_store_id()) then
    raise exception 'This return is not from your store' using errcode='insufficient_privilege';
  end if;
  if pk.direction <> 'RETURN' or pk.status <> 'RETURN_PACKED' then
    raise exception 'Only a packed return can be dispatched (is %)', pk.status using errcode='check_violation';
  end if;
  for pl in select sku_id, qty_expected from public.package_lines where package_id=p_package_id loop
    v_oh := public.get_on_hand(pk.consignee_id, pl.sku_id);
    if pl.qty_expected > v_oh then
      raise exception 'Not enough stock to return % (need %, have %)', (select sku from public.products where id=pl.sku_id), pl.qty_expected, v_oh using errcode='check_violation';
    end if;
  end loop;
  for pl in select sku_id, qty_expected from public.package_lines where package_id=p_package_id loop
    insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
    values (pk.consignee_id, pl.sku_id, 'RETURN_OUT', -pl.qty_expected, 'package', pk.id, auth.uid());
  end loop;
  update public.packages set status='RETURN_IN_TRANSIT', in_transit_at=now(), updated_at=now() where id=p_package_id;
end $function$;
