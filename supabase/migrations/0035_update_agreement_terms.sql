-- Let the agreement's own consignor (or store, or admin) edit its commercial terms.
create or replace function public.update_agreement_terms(
  p_id uuid,
  p_commission_pct numeric default null,
  p_cadence text default null,
  p_damage_liability text default null,
  p_damage_store_share_pct numeric default null,
  p_consignment_period_days integer default null,
  p_end_of_period_action text default null,
  p_is_active boolean default null
) returns public.agreements
language plpgsql security definer set search_path to 'public' as $$
declare a public.agreements; v_row public.agreements;
begin
  select * into a from public.agreements where id = p_id;
  if a.id is null then raise exception 'Agreement not found' using errcode='check_violation'; end if;
  if not (public.is_admin() or a.consignor_id = public.current_consignor_id() or a.store_id = public.current_store_id()) then
    raise exception 'Not authorized to edit this agreement' using errcode='insufficient_privilege';
  end if;
  if p_commission_pct is not null and (p_commission_pct < 0 or p_commission_pct > 100) then
    raise exception 'Commission must be between 0 and 100' using errcode='check_violation'; end if;
  if p_damage_store_share_pct is not null and (p_damage_store_share_pct < 0 or p_damage_store_share_pct > 100) then
    raise exception 'Store damage share must be between 0 and 100' using errcode='check_violation'; end if;
  if p_cadence is not null and p_cadence not in ('weekly','monthly','quarterly') then
    raise exception 'Invalid cadence' using errcode='check_violation'; end if;
  if p_damage_liability is not null and p_damage_liability not in ('consignor','store','shared') then
    raise exception 'Invalid damage liability' using errcode='check_violation'; end if;
  if p_end_of_period_action is not null and p_end_of_period_action not in ('return','extend','discount') then
    raise exception 'Invalid end-of-period action' using errcode='check_violation'; end if;
  update public.agreements set
    commission_pct = coalesce(p_commission_pct, commission_pct),
    settlement_cadence = coalesce(p_cadence, settlement_cadence),
    damage_liability = coalesce(p_damage_liability, damage_liability),
    damage_store_share_pct = coalesce(p_damage_store_share_pct, damage_store_share_pct),
    consignment_period_days = coalesce(p_consignment_period_days, consignment_period_days),
    end_of_period_action = coalesce(p_end_of_period_action, end_of_period_action),
    is_active = coalesce(p_is_active, is_active)
  where id = p_id returning * into v_row;
  return v_row;
end $$;
grant execute on function public.update_agreement_terms(uuid, numeric, text, text, numeric, integer, text, boolean) to authenticated;
