-- 0028: keep stock in sync — validate at BUILD time, not just at scan.
-- You could pack more than the warehouse holds and only hit the wall at dispatch.
-- Now "available to pack" = warehouse on-hand − units already committed to other
-- PACKED (not yet dispatched) packages, and the builder is capped to it, so a
-- scan never fails for lack of stock.

-- Outbound: available to pack per consignor product.
create or replace function public.available_to_pack(p_consignor uuid)
returns table(sku_id uuid, available int)
language sql stable security definer set search_path to 'public'
as $function$
  select pr.id,
         (coalesce(w.on_hand, 0) - coalesce(c.committed, 0))::int
  from public.products pr
  left join (
    select sku_id, sum(qty)::int on_hand
    from public.warehouse_entries where consignor_id = p_consignor group by sku_id
  ) w on w.sku_id = pr.id
  left join (
    select pl.sku_id, sum(pl.qty_expected)::int committed
    from public.package_lines pl join public.packages p on p.id = pl.package_id
    where p.consignor_id = p_consignor and p.direction = 'OUTBOUND' and p.status = 'PACKED'
    group by pl.sku_id
  ) c on c.sku_id = pr.id
  where pr.consignor_id = p_consignor;
$function$;

create or replace function public.create_outbound_package(p_consignor uuid, p_consignee uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_pkg uuid; v_line jsonb; v_sku uuid; v_qty int; v_avail int;
begin
  if not (public.is_admin() or (public.is_consignor_user() and p_consignor = public.current_consignor_id())) then
    raise exception 'Not authorized to create packages for this consignor' using errcode='insufficient_privilege';
  end if;
  if not exists (select 1 from public.agreements where consignor_id=p_consignor and store_id=p_consignee and is_active) then
    raise exception 'No active agreement between this consignor and store' using errcode='check_violation';
  end if;
  insert into public.packages (pkg_code, direction, consignor_id, consignee_id, status, created_by)
  values (public.gen_pkg_code('OUTBOUND'), 'OUTBOUND', p_consignor, p_consignee, 'PACKED', auth.uid())
  returning id into v_pkg;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := (v_line->>'sku_id')::uuid; v_qty := (v_line->>'qty')::int;
    if v_qty <= 0 then raise exception 'Quantity must be at least 1' using errcode='check_violation'; end if;
    v_avail := public.get_warehouse_on_hand(p_consignor, v_sku) - coalesce((
      select sum(pl.qty_expected) from public.package_lines pl join public.packages p2 on p2.id=pl.package_id
      where p2.consignor_id=p_consignor and p2.direction='OUTBOUND' and p2.status='PACKED' and pl.sku_id=v_sku
    ), 0);
    if v_qty > v_avail then
      raise exception 'Only % of % available to pack (the rest is already packed or dispatched)', v_avail, (select sku from public.products where id=v_sku) using errcode='check_violation';
    end if;
    insert into public.package_lines (package_id, sku_id, qty_expected) values (v_pkg, v_sku, v_qty);
  end loop;
  return v_pkg;
end $function$;

-- Returns: the store's available-to-return already accounts for stock, but a
-- RETURN_PACKED package now holds units too — subtract those so two returns
-- can't claim the same stock.
create or replace function public.build_return_package(p_consignor uuid, p_consignee uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_pkg uuid; v_line jsonb; v_sku uuid; v_qty int; v_avail int;
begin
  if not (public.is_admin() or p_consignee = public.current_store_id()) then
    raise exception 'Not authorized to build returns for this store' using errcode='insufficient_privilege';
  end if;
  insert into public.packages (pkg_code, direction, consignor_id, consignee_id, status, created_by)
  values (public.gen_pkg_code('RETURN'), 'RETURN', p_consignor, p_consignee, 'RETURN_PACKED', auth.uid())
  returning id into v_pkg;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := (v_line->>'sku_id')::uuid; v_qty := (v_line->>'qty')::int;
    v_avail := public.get_on_hand(p_consignee, v_sku) - coalesce((
      select sum(pl.qty_expected) from public.package_lines pl join public.packages p2 on p2.id=pl.package_id
      where p2.consignee_id=p_consignee and p2.direction='RETURN' and p2.status='RETURN_PACKED' and pl.sku_id=v_sku
    ), 0);
    if v_qty <= 0 or v_qty > v_avail then
      raise exception 'Return qty for % must be 1..% (available to return)', (select sku from public.products where id=v_sku), v_avail using errcode='check_violation';
    end if;
    insert into public.package_lines (package_id, sku_id, qty_expected) values (v_pkg, v_sku, v_qty);
  end loop;
  return v_pkg;
end $function$;
