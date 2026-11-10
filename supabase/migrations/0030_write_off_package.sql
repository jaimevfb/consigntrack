-- 0030: lost-package write-off. When a courier loses the whole box in transit,
-- the goods already left their origin at dispatch and were never received, so
-- on-hand is already correct. Writing off closes the package as LOST and logs
-- it. Either party (or admin) can declare it; only in-transit packages qualify.

create or replace function public.write_off_package(p_package_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare pk public.packages;
begin
  select * into pk from public.packages where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignor_id = public.current_consignor_id() or pk.consignee_id = public.current_store_id()) then
    raise exception 'Not authorized to write off this package' using errcode = 'insufficient_privilege';
  end if;
  if pk.status not in ('IN_TRANSIT', 'RETURN_IN_TRANSIT') then
    raise exception 'Only an in-transit package can be written off as lost (is %)', pk.status using errcode = 'check_violation';
  end if;
  update public.packages set status = 'LOST', updated_at = now() where id = p_package_id;
  insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
  values ('packages', p_package_id, 'status', pk.status, 'LOST (' || coalesce(p_reason, 'lost in transit') || ')', auth.uid());
end $function$;
