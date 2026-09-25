-- ConsignTrack — 0008 email-free signup
-- The hosted project has email confirmation ON, which both blocks instant login
-- and rate-limits signups on the free tier. This RPC provisions the account
-- directly (hashed password, pre-confirmed) so self-service signup is instant
-- and reliable, then the client signs in normally. Anon-callable by design
-- (it is the public signup endpoint); it only ever creates a brand-new account.

create or replace function public.signup_account(
  p_email text,
  p_password text,
  p_role text,
  p_org_name text,
  p_full_name text
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
  v_store uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters' using errcode = 'check_violation';
  end if;
  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'Organization name is required' using errcode = 'check_violation';
  end if;
  if p_role not in ('consignor', 'store_manager') then
    raise exception 'Role must be consignor or store_manager' using errcode = 'check_violation';
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

  if p_role = 'consignor' then
    insert into public.consignors (name, contact, type) values (p_org_name, v_email, 'artisan') returning id into v_consignor;
    insert into public.app_users (auth_user_id, role, consignor_id, full_name)
      values (v_uid, 'consignor', v_consignor, coalesce(nullif(trim(p_full_name), ''), p_org_name));
  else
    insert into public.stores (name, manager, contact) values (p_org_name, coalesce(nullif(trim(p_full_name), ''), p_org_name), v_email) returning id into v_store;
    insert into public.app_users (auth_user_id, role, store_id, full_name)
      values (v_uid, 'store_manager', v_store, coalesce(nullif(trim(p_full_name), ''), p_org_name));
  end if;

  return v_uid;
end;
$$;

revoke execute on function public.signup_account(text, text, text, text, text) from public;
grant execute on function public.signup_account(text, text, text, text, text) to anon, authenticated;
