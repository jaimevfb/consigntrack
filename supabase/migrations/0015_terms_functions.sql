-- ConsignTrack — 0015 functions for the commercial terms added in 0014.

-- ===========================================================================
-- Q1/Q2/Q3/Q4/Q5 — connect_agreement now captures all commercial terms.
-- Drop the old 4-arg version so the extended (defaulted) one is unambiguous.
-- ===========================================================================
drop function if exists public.connect_agreement(uuid, uuid, numeric, text);

create or replace function public.connect_agreement(
  p_consignor_id uuid,
  p_store_id uuid,
  p_commission_pct numeric,
  p_cadence text default 'monthly',
  p_damage_liability text default 'consignor',
  p_damage_store_share_pct numeric default 50,
  p_consignment_period_days integer default 60,
  p_end_of_period_action text default 'return',
  p_grace_extend_days integer default 30,
  p_markdown_pct numeric default 20,
  p_receipt_grace_days integer default 14
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
  if p_damage_liability not in ('consignor','store','shared') then
    raise exception 'Invalid damage liability' using errcode = 'check_violation';
  end if;
  if p_end_of_period_action not in ('return','extend','discount') then
    raise exception 'Invalid end-of-period action' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.agreements where consignor_id=p_consignor_id and store_id=p_store_id and is_active) then
    raise exception 'An active agreement already exists between these partners' using errcode = 'unique_violation';
  end if;

  insert into public.agreements (
    consignor_id, store_id, commission_pct, settlement_cadence, is_active,
    damage_liability, damage_store_share_pct, consignment_period_days,
    end_of_period_action, grace_extend_days, markdown_pct, receipt_grace_days)
  values (
    p_consignor_id, p_store_id, p_commission_pct, p_cadence, true,
    p_damage_liability, p_damage_store_share_pct, p_consignment_period_days,
    p_end_of_period_action, p_grace_extend_days, p_markdown_pct, p_receipt_grace_days)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.connect_agreement(uuid, uuid, numeric, text, text, numeric, integer, text, integer, numeric, integer) to authenticated;

-- ===========================================================================
-- update_agreement_terms — edit the commercial terms of an existing agreement.
-- ===========================================================================
create or replace function public.update_agreement_terms(
  p_agreement_id uuid,
  p_commission_pct numeric default null,
  p_cadence text default null,
  p_damage_liability text default null,
  p_damage_store_share_pct numeric default null,
  p_consignment_period_days integer default null,
  p_end_of_period_action text default null,
  p_grace_extend_days integer default null,
  p_markdown_pct numeric default null,
  p_receipt_grace_days integer default null
)
returns public.agreements
language plpgsql
security definer
set search_path = public
as $$
declare a public.agreements; v_row public.agreements;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception 'Agreement not found' using errcode='no_data_found'; end if;
  if not (public.is_admin()
          or public.current_consignor_id() = a.consignor_id
          or public.current_store_id() = a.store_id) then
    raise exception 'Not your agreement' using errcode='insufficient_privilege';
  end if;

  update public.agreements set
    commission_pct          = coalesce(p_commission_pct, commission_pct),
    settlement_cadence      = coalesce(p_cadence, settlement_cadence),
    damage_liability        = coalesce(p_damage_liability, damage_liability),
    damage_store_share_pct  = coalesce(p_damage_store_share_pct, damage_store_share_pct),
    consignment_period_days = coalesce(p_consignment_period_days, consignment_period_days),
    end_of_period_action    = coalesce(p_end_of_period_action, end_of_period_action),
    grace_extend_days       = coalesce(p_grace_extend_days, grace_extend_days),
    markdown_pct            = coalesce(p_markdown_pct, markdown_pct),
    receipt_grace_days      = coalesce(p_receipt_grace_days, receipt_grace_days)
  where id = p_agreement_id
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.update_agreement_terms(uuid, numeric, text, text, numeric, integer, text, integer, numeric, integer) to authenticated;

-- ===========================================================================
-- Q1 — set / clear a per-product commission override.
-- ===========================================================================
create or replace function public.set_commission_override(
  p_agreement_id uuid, p_product_id uuid, p_commission_pct numeric)
returns public.commission_overrides
language plpgsql security definer set search_path = public as $$
declare a public.agreements; v_row public.commission_overrides;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception 'Agreement not found' using errcode='no_data_found'; end if;
  if not (public.is_admin()
          or public.current_consignor_id() = a.consignor_id
          or public.current_store_id() = a.store_id) then
    raise exception 'Not your agreement' using errcode='insufficient_privilege';
  end if;
  if p_commission_pct < 0 or p_commission_pct > 100 then
    raise exception 'Commission must be between 0 and 100' using errcode='check_violation';
  end if;
  insert into public.commission_overrides (agreement_id, product_id, commission_pct)
  values (p_agreement_id, p_product_id, p_commission_pct)
  on conflict (agreement_id, product_id)
    do update set commission_pct = excluded.commission_pct
  returning * into v_row;
  return v_row;
end; $$;

grant execute on function public.set_commission_override(uuid, uuid, numeric) to authenticated;

create or replace function public.remove_commission_override(p_agreement_id uuid, p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.agreements;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception 'Agreement not found' using errcode='no_data_found'; end if;
  if not (public.is_admin()
          or public.current_consignor_id() = a.consignor_id
          or public.current_store_id() = a.store_id) then
    raise exception 'Not your agreement' using errcode='insufficient_privilege';
  end if;
  delete from public.commission_overrides where agreement_id=p_agreement_id and product_id=p_product_id;
end; $$;

grant execute on function public.remove_commission_override(uuid, uuid) to authenticated;

-- ===========================================================================
-- Q4 — pin the display window when an item is received (BEFORE UPDATE so we
-- can set NEW; only once, only when the agreement defines a period).
-- ===========================================================================
create or replace function public.pin_display_window()
returns trigger language plpgsql as $$
declare v_days integer;
begin
  if new.status = 'received_confirmed'
     and old.status is distinct from 'received_confirmed'
     and new.display_expires_at is null then
    select consignment_period_days into v_days
      from public.agreements
     where consignor_id = new.consignor_id and store_id = new.store_id and is_active
     limit 1;
    if v_days is not null then
      new.display_expires_at := now() + (v_days || ' days')::interval;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists t_items_pin_display on public.items;
create trigger t_items_pin_display
  before update on public.items
  for each row execute function public.pin_display_window();

-- ===========================================================================
-- Q2 — apply the end-of-period policy to items past their display window.
--   extend   -> push expiry out by grace_extend_days (data only, automatic)
--   discount -> mark asking_price down by markdown_pct AND extend (automatic)
--   return   -> raise a 'period_ended' exception so staff physically return it
--               (we never auto-move physical goods)
-- Returns a jsonb tally. Admin / store / consignor scoped by RLS on reads;
-- definer so the sweep can act across the pair.
-- ===========================================================================
create or replace function public.expire_items()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_extended int := 0; v_discounted int := 0; v_flagged int := 0; r record;
begin
  for r in
    select i.id, i.asking_price, i.consignor_id, i.store_id,
           a.end_of_period_action, a.grace_extend_days, a.markdown_pct
      from public.items i
      join public.agreements a
        on a.consignor_id = i.consignor_id and a.store_id = i.store_id and a.is_active
     where i.status in ('received_confirmed','listed')
       and i.display_expires_at is not null
       and i.display_expires_at < now()
  loop
    if r.end_of_period_action = 'extend' then
      update public.items
         set display_expires_at = now() + (r.grace_extend_days || ' days')::interval
       where id = r.id;
      v_extended := v_extended + 1;
    elsif r.end_of_period_action = 'discount' then
      update public.items
         set asking_price = round(r.asking_price * (100 - r.markdown_pct) / 100.0, 2),
             display_expires_at = now() + (r.grace_extend_days || ' days')::interval
       where id = r.id;
      v_discounted := v_discounted + 1;
    else -- 'return'
      if not exists (select 1 from public.exceptions
                      where item_id = r.id and kind = 'period_ended' and status = 'open') then
        insert into public.exceptions (item_id, kind, detail, raised_by)
        values (r.id, 'period_ended', 'Consignment period ended — return to consignor', auth.uid());
        v_flagged := v_flagged + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('extended', v_extended, 'discounted', v_discounted, 'flagged_for_return', v_flagged);
end; $$;

grant execute on function public.expire_items() to authenticated;

-- ===========================================================================
-- Q5 — close deliveries left in 'sent' past the receipt grace window:
-- unreceived items are flagged 'lost', the delivery is marked 'confirmed'.
-- Grace comes from the agreement (receipt_grace_days), default 14.
-- ===========================================================================
create or replace function public.close_stale_deliveries(p_default_days integer default 14)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_closed int := 0; v_lost int := 0; d record; it record; v_grace int;
begin
  for d in
    select dl.id, dl.consignor_id, dl.store_id, dl.created_at
      from public.deliveries dl
     where dl.status = 'sent'
  loop
    select coalesce(a.receipt_grace_days, p_default_days) into v_grace
      from public.agreements a
     where a.consignor_id = d.consignor_id and a.store_id = d.store_id and a.is_active
     limit 1;
    v_grace := coalesce(v_grace, p_default_days);
    if d.created_at >= now() - (v_grace || ' days')::interval then
      continue; -- still within grace
    end if;

    for it in
      select id, product_id, store_id, consignor_id, code, status
        from public.items
       where delivery_id = d.id
         and status in ('created','labeled','dispatched','in_transit','delivered')
    loop
      update public.items set status = 'lost', current_holder = 'none' where id = it.id;
      insert into public.scan_events (item_id, actor_id, actor_role, event_type, from_status, to_status, note, is_exception, reason)
      values (it.id, auth.uid(), 'system', 'flag_lost', it.status, 'lost', 'Auto-closed: receipt grace elapsed', true, 'Never received within grace window');
      insert into public.exceptions (item_id, kind, detail, raised_by)
      values (it.id, 'loss', 'Delivery auto-closed after receipt grace window', auth.uid());
      v_lost := v_lost + 1;
    end loop;

    update public.deliveries
       set status = 'confirmed', confirmed_at = now()
     where id = d.id;
    v_closed := v_closed + 1;
  end loop;
  return jsonb_build_object('deliveries_closed', v_closed, 'items_flagged_lost', v_lost);
end; $$;

grant execute on function public.close_stale_deliveries(integer) to authenticated;

-- ===========================================================================
-- run_period_maintenance — one call for the admin: expiry sweep + stale close.
-- ===========================================================================
create or replace function public.run_period_maintenance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_exp jsonb; v_close jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode='insufficient_privilege';
  end if;
  v_exp := public.expire_items();
  v_close := public.close_stale_deliveries();
  return jsonb_build_object('expiry', v_exp, 'stale_deliveries', v_close);
end; $$;

grant execute on function public.run_period_maintenance() to authenticated;

-- ===========================================================================
-- Q1+Q3 — generate_settlement rewritten:
--   * commission uses the per-product override rate when one exists, else flat
--   * damage_total deducts the consignor's share of lost/damaged value per the
--     liability model (consignor=full, store=0, shared=consignor's slice)
--   net_payable = gross_sales − commission − returns_total − damage_total
-- ===========================================================================
create or replace function public.generate_settlement(
  p_agreement_id uuid,
  p_period_start date,
  p_period_end date
)
returns public.settlements
language plpgsql
as $$
declare
  a public.agreements;
  v_gross numeric(12,2) := 0;
  v_returns numeric(12,2) := 0;
  v_commission numeric(12,2) := 0;
  v_damage_value numeric(12,2) := 0;
  v_damage_total numeric(12,2) := 0;
  v_store_share numeric(5,2);
  v_net numeric(12,2) := 0;
  s public.settlements;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'no_data_found';
  end if;

  -- gross sales for this pair within the period
  select coalesce(sum(si.qty * si.unit_price), 0)
    into v_gross
    from public.sale_items si
    join public.sales sa on sa.id = si.sale_id
   where sa.store_id = a.store_id
     and si.consignor_id = a.consignor_id
     and sa.sold_at::date between p_period_start and p_period_end;

  -- commission: per-product override rate when present, else the flat rate
  select coalesce(sum(round(line_gross * coalesce(co.commission_pct, a.commission_pct) / 100.0, 2)), 0)
    into v_commission
    from (
      select si.product_id, sum(si.qty * si.unit_price) as line_gross
        from public.sale_items si
        join public.sales sa on sa.id = si.sale_id
       where sa.store_id = a.store_id
         and si.consignor_id = a.consignor_id
         and sa.sold_at::date between p_period_start and p_period_end
       group by si.product_id
    ) lines
    left join public.commission_overrides co
      on co.agreement_id = a.id and co.product_id = lines.product_id;

  -- returns value in the period (qty × current catalogue price)
  select coalesce(sum(r.qty * p.unit_price), 0)
    into v_returns
    from public.returns r
    join public.products p on p.id = r.product_id
   where r.store_id = a.store_id
     and r.consignor_id = a.consignor_id
     and r.return_date between p_period_start and p_period_end;

  -- damage/loss value in the period, from exceptions on this pair's items
  select coalesce(sum(coalesce(i.asking_price, 0)), 0)
    into v_damage_value
    from public.exceptions e
    join public.items i on i.id = e.item_id
   where i.store_id = a.store_id
     and i.consignor_id = a.consignor_id
     and e.kind in ('loss','damage')
     and e.created_at::date between p_period_start and p_period_end;

  -- store's share of the loss; consignor absorbs the remainder
  v_store_share := case a.damage_liability
                     when 'store' then 100
                     when 'consignor' then 0
                     else a.damage_store_share_pct end;
  v_damage_total := round(v_damage_value * (100 - v_store_share) / 100.0, 2);

  v_net := v_gross - v_commission - v_returns - v_damage_total;

  delete from public.settlements
   where agreement_id = p_agreement_id
     and period_start = p_period_start
     and period_end = p_period_end
     and status = 'pending';

  insert into public.settlements
    (agreement_id, period_start, period_end, gross_sales, commission, returns_total, damage_total, net_payable, status)
  values
    (p_agreement_id, p_period_start, p_period_end, v_gross, v_commission, v_returns, v_damage_total, v_net, 'pending')
  returning * into s;

  insert into public.settlement_lines (settlement_id, product_id, qty_sold, gross)
  select s.id, si.product_id, sum(si.qty), sum(si.qty * si.unit_price)
    from public.sale_items si
    join public.sales sa on sa.id = si.sale_id
   where sa.store_id = a.store_id
     and si.consignor_id = a.consignor_id
     and sa.sold_at::date between p_period_start and p_period_end
   group by si.product_id;

  return s;
end;
$$;
