-- Admin: terminate a consignor or store account. Revokes sign-in (bans the auth
-- user + drops their role mapping) and deactivates their agreements, while
-- preserving history (products, ledger, settlements stay intact for the record).
create or replace function public.admin_terminate_account(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare v_uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can terminate accounts' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('consignor', 'store') then
    raise exception 'Unknown account kind %', p_kind using errcode = 'check_violation';
  end if;

  -- ban every sign-in mapped to this consignor/store
  for v_uid in
    select auth_user_id from public.app_users
    where (p_kind = 'consignor' and consignor_id = p_id)
       or (p_kind = 'store' and store_id = p_id)
  loop
    update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = v_uid;
  end loop;

  -- drop their role mapping so they have no scope even if the ban is lifted
  delete from public.app_users
   where (p_kind = 'consignor' and consignor_id = p_id)
      or (p_kind = 'store' and store_id = p_id);

  -- sever active agreements so stock/settlements stop flowing
  if p_kind = 'consignor' then
    update public.agreements set is_active = false where consignor_id = p_id;
  else
    update public.agreements set is_active = false where store_id = p_id;
  end if;
end $$;

grant execute on function public.admin_terminate_account(text, uuid) to authenticated;
