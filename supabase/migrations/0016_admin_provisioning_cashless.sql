-- ConsignTrack — 0016 admin-issued provisioning + cashless settlement demo
--
-- Two product decisions land here:
--   1. Accounts are ADMIN-ISSUED only. Self-serve signup is retired: the
--      public signup_account / register_profile RPCs lose their grants, and
--      two admin-only RPCs provision consignors and consignee (store) accounts.
--      Issuing a store account also forms the agreement, so the consignee sees
--      the consignor's products immediately (products_select RLS already allows
--      a store to read products of any consignor it has an active agreement with).
--   2. Settlement payment becomes a demo CASHLESS transaction: payments carry a
--      method + reference, so the store "sends" a cashless payment and the
--      consignor sees the method/reference/amount before confirming receipt.

-- ===========================================================================
-- Part A — cashless payment fields
-- ===========================================================================
alter table public.payments
  add column if not exists method text,
  add column if not exists reference text;

-- mark_settlement_paid — now records the cashless method + a transaction
-- reference. Backwards-compatible: both new args default, and a null reference
-- is auto-generated (CT-XXXXXXXX) so every payment has a traceable ref.
create or replace function public.mark_settlement_paid(
  p_settlement_id uuid,
  p_method text default 'gcash',
  p_reference text default null
)
returns public.settlements
language plpgsql
as $$
declare
  s public.settlements;
  v_payment_id uuid;
  v_ref text := coalesce(nullif(trim(p_reference), ''),
                         'CT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
  v_method text := coalesce(nullif(trim(p_method), ''), 'gcash');
begin
  select * into s from public.settlements where id = p_settlement_id for update;
  if not found then
    raise exception 'settlement % not found', p_settlement_id using errcode = 'no_data_found';
  end if;

  select id into v_payment_id from public.payments where settlement_id = p_settlement_id limit 1;
  if v_payment_id is null then
    insert into public.payments (settlement_id, amount, paid_at, method, reference)
    values (p_settlement_id, s.net_payable, now(), v_method, v_ref);
  else
    update public.payments
       set amount = s.net_payable, paid_at = now(), method = v_method, reference = v_ref
     where id = v_payment_id;
  end if;

  update public.settlements set status = 'paid' where id = p_settlement_id returning * into s;
  return s;
end;
$$;

-- Drop the old single-arg overload so every payment records a method + reference.
drop function if exists public.mark_settlement_paid(uuid);

-- ===========================================================================
-- Part B — retire self-serve signup (admin-issued accounts only)
-- ===========================================================================
revoke execute on function public.signup_account(text, text, text, text, text) from anon, authenticated;
do $$ begin
  revoke execute on function public.register_profile(text, text, text, text, text) from anon, authenticated;
exception when undefined_function then null; end $$;

-- ===========================================================================
-- Part C — admin_create_consignor: provision a consignor account.
-- ===========================================================================
create or replace function public.admin_create_consignor(
  p_email text,
  p_password text,
  p_full_name text,
  p_org_name text,
  p_contact text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_uid uuid := gen_random_uuid();
  v_consignor uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can issue accounts' using errcode = 'insufficient_privilege';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters' using errcode = 'check_violation';
  end if;
  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'Business name is required' using errcode = 'check_violation';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'An account with that email already exists' using errcode = 'unique_violation';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());

  insert into public.consignors (name, contact, type)
    values (p_org_name, coalesce(nullif(trim(p_contact), ''), v_email), 'artisan')
    returning id into v_consignor;
  insert into public.app_users (auth_user_id, role, consignor_id, full_name)
    values (v_uid, 'consignor', v_consignor, coalesce(nullif(trim(p_full_name), ''), p_org_name));

  return v_consignor;
end;
$$;

revoke execute on function public.admin_create_consignor(text, text, text, text, text) from anon, public;
grant execute on function public.admin_create_consignor(text, text, text, text, text) to authenticated;

-- ===========================================================================
-- Part D — admin_issue_store_account: provision a consignee (store) account
-- AND connect it to a consignor via an agreement in one step. The store then
-- sees that consignor's products immediately (products_select RLS).
-- ===========================================================================
create or replace function public.admin_issue_store_account(
  p_email text,
  p_password text,
  p_full_name text,
  p_store_name text,
  p_consignor_id uuid,
  p_commission_pct numeric,
  p_cadence text default 'monthly',
  p_location text default null,
  p_contact text default null,
  p_damage_liability text default 'consignor',
  p_damage_store_share_pct numeric default 50,
  p_consignment_period_days integer default 60,
  p_end_of_period_action text default 'return'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_uid uuid := gen_random_uuid();
  v_store uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can issue accounts' using errcode = 'insufficient_privilege';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters' using errcode = 'check_violation';
  end if;
  if coalesce(trim(p_store_name), '') = '' then
    raise exception 'Store name is required' using errcode = 'check_violation';
  end if;
  if p_consignor_id is null or not exists (select 1 from public.consignors where id = p_consignor_id) then
    raise exception 'Select the consignor this store is connected to' using errcode = 'check_violation';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'An account with that email already exists' using errcode = 'unique_violation';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());

  insert into public.stores (name, location, manager, contact)
    values (p_store_name, p_location, coalesce(nullif(trim(p_full_name), ''), p_store_name),
            coalesce(nullif(trim(p_contact), ''), v_email))
    returning id into v_store;
  insert into public.app_users (auth_user_id, role, store_id, full_name)
    values (v_uid, 'store_manager', v_store, coalesce(nullif(trim(p_full_name), ''), p_store_name));

  -- Connect the agreement so the consignee sees the consignor's products at once.
  insert into public.agreements (
    consignor_id, store_id, commission_pct, settlement_cadence, is_active,
    damage_liability, damage_store_share_pct, consignment_period_days, end_of_period_action
  ) values (
    p_consignor_id, v_store, p_commission_pct, coalesce(nullif(trim(p_cadence), ''), 'monthly'), true,
    coalesce(nullif(trim(p_damage_liability), ''), 'consignor'),
    coalesce(p_damage_store_share_pct, 50),
    coalesce(p_consignment_period_days, 60),
    coalesce(nullif(trim(p_end_of_period_action), ''), 'return')
  );

  return v_store;
end;
$$;

revoke execute on function public.admin_issue_store_account(text, text, text, text, uuid, numeric, text, text, text, text, numeric, integer, text) from anon, public;
grant execute on function public.admin_issue_store_account(text, text, text, text, uuid, numeric, text, text, text, text, numeric, integer, text) to authenticated;
