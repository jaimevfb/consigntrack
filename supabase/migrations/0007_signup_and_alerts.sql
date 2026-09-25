-- ConsignTrack — 0007 self-service signup + alert/discrepancy detection
-- Adds: confirm_signup (demo auto-confirm), register_profile (onboarding),
-- find_aged_stock + find_low_stock (paper SOP#5 discrepancy/alerting).

-- ---------------------------------------------------------------------------
-- confirm_signup — demo convenience so new signups can log in without the
-- email round-trip. Only confirms a freshly-created, still-unconfirmed user.
-- (In production you would enable Supabase email confirmations instead.)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_signup(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  ok boolean := false;
begin
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = coalesce(confirmation_token, ''),
         recovery_token = coalesce(recovery_token, ''),
         email_change = coalesce(email_change, ''),
         email_change_token_new = coalesce(email_change_token_new, ''),
         email_change_token_current = coalesce(email_change_token_current, ''),
         phone_change = coalesce(phone_change, ''),
         phone_change_token = coalesce(phone_change_token, ''),
         reauthentication_token = coalesce(reauthentication_token, '')
   where id = p_user_id
     and email_confirmed_at is null
     and created_at > now() - interval '10 minutes'
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

grant execute on function public.confirm_signup(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- register_profile — onboarding for a signed-in user with no profile yet.
-- Self-service roles: 'consignor' (creates a consignor) or 'store_manager'
-- (creates a store). Admin/staff are provisioned by others.
-- ---------------------------------------------------------------------------
create or replace function public.register_profile(
  p_role text,
  p_org_name text,
  p_full_name text,
  p_contact text default null,
  p_location text default null
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_consignor uuid;
  v_store uuid;
  v_row public.app_users;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.app_users where auth_user_id = v_uid) then
    raise exception 'profile already exists' using errcode = 'unique_violation';
  end if;
  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'organization name is required' using errcode = 'check_violation';
  end if;

  if p_role = 'consignor' then
    insert into public.consignors (name, contact, type)
      values (p_org_name, p_contact, 'artisan') returning id into v_consignor;
    insert into public.app_users (auth_user_id, role, consignor_id, full_name)
      values (v_uid, 'consignor', v_consignor, coalesce(nullif(trim(p_full_name),''), p_org_name))
      returning * into v_row;

  elsif p_role = 'store_manager' then
    insert into public.stores (name, location, manager, contact)
      values (p_org_name, p_location, coalesce(nullif(trim(p_full_name),''), p_org_name), p_contact)
      returning id into v_store;
    insert into public.app_users (auth_user_id, role, store_id, full_name)
      values (v_uid, 'store_manager', v_store, coalesce(nullif(trim(p_full_name),''), p_org_name))
      returning * into v_row;

  else
    raise exception 'role must be consignor or store_manager' using errcode = 'check_violation';
  end if;

  return v_row;
end;
$$;

grant execute on function public.register_profile(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- find_aged_stock (paper SOP#5) — stock on hand that has not sold in N days.
-- INVOKER, so each user sees only their own scope (RLS applies).
-- ---------------------------------------------------------------------------
create or replace function public.find_aged_stock(p_days integer default 30)
returns table (
  store_id uuid,
  product_id uuid,
  consignor_id uuid,
  qty_on_hand integer,
  last_sold_at timestamptz,
  days_idle integer
)
language sql
stable
as $$
  select
    sl.store_id, sl.product_id, sl.consignor_id, sl.qty_on_hand,
    ls.last_sold_at,
    case when ls.last_sold_at is null then null
         else extract(day from (now() - ls.last_sold_at))::int end as days_idle
  from public.stock_levels sl
  left join (
    select store_id, product_id, consignor_id, max(created_at) as last_sold_at
    from public.stock_movements
    where movement_type = 'sale'
    group by store_id, product_id, consignor_id
  ) ls
    on ls.store_id = sl.store_id and ls.product_id = sl.product_id and ls.consignor_id = sl.consignor_id
  where sl.qty_on_hand > 0
    and (ls.last_sold_at is null or ls.last_sold_at < now() - make_interval(days => p_days));
$$;

-- ---------------------------------------------------------------------------
-- find_low_stock — on-hand at or below a threshold (but not zero).
-- ---------------------------------------------------------------------------
create or replace function public.find_low_stock(p_threshold integer default 5)
returns table (
  store_id uuid,
  product_id uuid,
  consignor_id uuid,
  qty_on_hand integer
)
language sql
stable
as $$
  select store_id, product_id, consignor_id, qty_on_hand
  from public.stock_levels
  where qty_on_hand > 0 and qty_on_hand <= p_threshold;
$$;

grant execute on function public.find_aged_stock(integer) to authenticated;
grant execute on function public.find_low_stock(integer) to authenticated;
