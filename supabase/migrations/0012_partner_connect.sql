-- ConsignTrack — 0012 self-serve onboarding: partner directory + connect.
-- A freshly signed-up consignor or store has no agreements and (by RLS) can't
-- see potential partners, so it is isolated. These definer RPCs let either side
-- discover partners and establish an agreement, wiring a new account into the
-- shared ledger immediately.

create or replace function public.partner_directory(p_kind text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name from public.stores where p_kind = 'store'
  union all
  select id, name from public.consignors where p_kind = 'consignor'
  order by name;
$$;

grant execute on function public.partner_directory(text) to authenticated;

create or replace function public.connect_agreement(
  p_consignor_id uuid,
  p_store_id uuid,
  p_commission_pct numeric,
  p_cadence text default 'monthly'
)
returns public.agreements
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.agreements;
begin
  if not (public.is_admin()
          or public.current_consignor_id() = p_consignor_id
          or public.current_store_id() = p_store_id) then
    raise exception 'You can only connect agreements that involve your own account'
      using errcode = 'insufficient_privilege';
  end if;
  if p_commission_pct < 0 or p_commission_pct > 100 then
    raise exception 'Commission must be between 0 and 100' using errcode = 'check_violation';
  end if;
  if p_cadence not in ('weekly','monthly','quarterly') then
    raise exception 'Invalid cadence' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.agreements where consignor_id=p_consignor_id and store_id=p_store_id and is_active) then
    raise exception 'An active agreement already exists between these partners' using errcode = 'unique_violation';
  end if;

  insert into public.agreements (consignor_id, store_id, commission_pct, settlement_cadence, is_active)
  values (p_consignor_id, p_store_id, p_commission_pct, p_cadence, true)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.connect_agreement(uuid, uuid, numeric, text) to authenticated;
