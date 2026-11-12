-- Validate a scanned piece (exists, in-stock, not sold) WITHOUT selling it,
-- so scans can be added to the cart first and only sold on checkout.
create or replace function public.lookup_unit(p_serial text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_unit public.product_units; v_store uuid; v_price numeric; v_name text; v_sku uuid;
begin
  v_store := public.current_store_id();
  if not (public.is_admin() or v_store is not null) then
    raise exception 'Only store accounts can scan sales' using errcode='insufficient_privilege';
  end if;
  select * into v_unit from public.product_units where serial = p_serial;
  if v_unit.id is null then raise exception 'No piece found for barcode %', p_serial using errcode='check_violation'; end if;
  if v_unit.status = 'sold' then raise exception 'That piece (%) is already sold', p_serial using errcode='check_violation'; end if;
  if v_unit.status <> 'in_stock' then raise exception 'That piece is not sellable (%)', v_unit.status using errcode='check_violation'; end if;
  select id, name, unit_price into v_sku, v_name, v_price from public.products where id = v_unit.product_id;
  return jsonb_build_object('sku_id', v_sku, 'name', v_name, 'price', v_price, 'serial', p_serial);
end $$;
grant execute on function public.lookup_unit(text) to authenticated;
