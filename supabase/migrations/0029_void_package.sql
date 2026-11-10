-- 0029: void a pre-receipt package. Manifests are immutable, but a wrong
-- dispatch before the other side receives it must be reversible. Voiding posts
-- compensating ADJUSTMENT entries (stock back where it came from) and locks the
-- package as VOID. Received/settled packages cannot be voided.

create or replace function public.void_package(p_package_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare pk public.packages; pl record;
begin
  select * into pk from public.packages where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;

  if pk.direction = 'OUTBOUND' then
    if not (public.is_admin() or pk.consignor_id = public.current_consignor_id()) then
      raise exception 'Only the sending consignor can void this package' using errcode = 'insufficient_privilege';
    end if;
    if pk.status not in ('PACKED', 'IN_TRANSIT') then
      raise exception 'Only a packed or in-transit package can be voided (is %)', pk.status using errcode = 'check_violation';
    end if;
    if pk.status = 'IN_TRANSIT' then
      -- dispatch had removed warehouse stock → put it back
      for pl in select sku_id, qty_expected from public.package_lines where package_id = p_package_id loop
        insert into public.warehouse_entries (consignor_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
        values (pk.consignor_id, pl.sku_id, 'ADJUSTMENT', pl.qty_expected, 'package', pk.id, auth.uid());
      end loop;
    end if;

  elsif pk.direction = 'RETURN' then
    if not (public.is_admin() or pk.consignee_id = public.current_store_id()) then
      raise exception 'Only the sending store can void this return' using errcode = 'insufficient_privilege';
    end if;
    if pk.status not in ('RETURN_PACKED', 'RETURN_IN_TRANSIT') then
      raise exception 'Only a packed or in-transit return can be voided (is %)', pk.status using errcode = 'check_violation';
    end if;
    if pk.status = 'RETURN_IN_TRANSIT' then
      -- dispatch had removed store stock → put it back
      for pl in select sku_id, qty_expected from public.package_lines where package_id = p_package_id loop
        insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id, reason)
        values (pk.consignee_id, pl.sku_id, 'ADJUSTMENT', pl.qty_expected, 'package', pk.id, auth.uid(), 'void ' || pk.pkg_code);
      end loop;
    end if;
  else
    raise exception 'Unknown package direction';
  end if;

  update public.packages set status = 'VOID', updated_at = now() where id = p_package_id;
end $function$;
