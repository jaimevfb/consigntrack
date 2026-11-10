-- ConsignTrack — 0019 ledger state-machine RPCs (Phase 4 core)
-- All stock moves go through these; each writes append-only ledger_entries and
-- enforces its state machine. Prices live on SALE entries so settlements compute
-- strictly from the ledger.

alter table public.ledger_entries add column if not exists unit_price numeric;

-- ---------------------------------------------------------------------------
-- Package code generator
-- ---------------------------------------------------------------------------
create or replace function public.gen_pkg_code(p_dir text)
returns text language plpgsql as $$
declare v_prefix text; v_code text;
begin
  v_prefix := case when p_dir = 'RETURN' then 'RET-' else 'PKG-' end;
  loop
    v_code := v_prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.packages where pkg_code = v_code);
  end loop;
  return v_code;
end $$;

-- ---------------------------------------------------------------------------
-- create_outbound_package — consignor builds a shipment to a store (PACKED)
-- p_lines: [{"sku_id":uuid,"qty":int}]
-- ---------------------------------------------------------------------------
create or replace function public.create_outbound_package(
  p_consignor uuid, p_consignee uuid, p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_pkg uuid; v_line jsonb;
begin
  if not (public.is_admin() or (public.is_consignor_user() and p_consignor = public.current_consignor_id())) then
    raise exception 'Not authorized to create packages for this consignor' using errcode='insufficient_privilege';
  end if;
  if not exists (select 1 from public.agreements where consignor_id=p_consignor and store_id=p_consignee and is_active) then
    raise exception 'No active agreement between this consignor and store' using errcode='check_violation';
  end if;
  insert into public.packages (pkg_code, direction, consignor_id, consignee_id, status, created_by)
  values (public.gen_pkg_code('OUTBOUND'), 'OUTBOUND', p_consignor, p_consignee, 'PACKED', auth.uid())
  returning id into v_pkg;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.package_lines (package_id, sku_id, qty_expected)
    values (v_pkg, (v_line->>'sku_id')::uuid, (v_line->>'qty')::int);
  end loop;
  return v_pkg;
end $$;

-- ---------------------------------------------------------------------------
-- dispatch_package — PACKED -> IN_TRANSIT
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_package(p_package_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pk public.packages;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if pk.status <> 'PACKED' then raise exception 'Only a PACKED package can be dispatched (is %)', pk.status using errcode='check_violation'; end if;
  update public.packages set status='IN_TRANSIT', in_transit_at=now(), updated_at=now() where id=p_package_id;
end $$;

-- ---------------------------------------------------------------------------
-- receive_package — dock confirmation. Wrong-destination + state guards.
-- p_lines: [{"line_id":uuid,"qty_received":int,"qty_disputed":int,"photo":text}]
-- ---------------------------------------------------------------------------
create or replace function public.receive_package(p_package_id uuid, p_lines jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare pk public.packages; v_line jsonb; pl public.package_lines; v_disputed boolean := false;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignee_id = public.current_store_id()) then
    raise exception 'Wrong destination — this package is not for your store' using errcode='insufficient_privilege';
  end if;
  if pk.status <> 'IN_TRANSIT' then
    raise exception 'Only an IN_TRANSIT package can be received (is %)', pk.status using errcode='check_violation';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into pl from public.package_lines where id=(v_line->>'line_id')::uuid and package_id=p_package_id;
    if not found then continue; end if;
    update public.package_lines
      set qty_received=(v_line->>'qty_received')::int,
          qty_disputed=coalesce((v_line->>'qty_disputed')::int,0),
          dispute_photo_url=v_line->>'photo'
      where id=pl.id;
    if coalesce((v_line->>'qty_received')::int,0) > 0 then
      insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
      values (pk.consignee_id, pl.sku_id, 'RECEIVE', (v_line->>'qty_received')::int, 'package', pk.id, auth.uid());
    end if;
    if coalesce((v_line->>'qty_disputed')::int,0) > 0 then
      v_disputed := true;
      insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id, reason)
      values (pk.consignee_id, pl.sku_id, 'DISPUTE_HOLD', -(v_line->>'qty_disputed')::int, 'package', pk.id, auth.uid(), 'discrepancy at receiving');
    end if;
  end loop;

  update public.packages set status = case when v_disputed then 'PARTIAL_DISPUTED' else 'DELIVERED' end,
    updated_at=now() where id=p_package_id;
  return case when v_disputed then 'PARTIAL_DISPUTED' else 'DELIVERED' end;
end $$;

-- ---------------------------------------------------------------------------
-- pos_sale — SALE entries with server-side oversell guard; price on the entry.
-- p_lines: [{"sku_id":uuid,"qty":int,"unit_price":numeric}]
-- ---------------------------------------------------------------------------
create or replace function public.pos_sale(p_consignee uuid, p_lines jsonb, p_source text default 'MANUAL')
returns void language plpgsql security definer set search_path = public as $$
declare v_line jsonb; v_sku uuid; v_qty int; v_price numeric; v_onhand int;
begin
  if not (public.is_admin() or p_consignee = public.current_store_id()) then
    raise exception 'Not authorized to record sales for this store' using errcode='insufficient_privilege';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := (v_line->>'sku_id')::uuid;
    v_qty := (v_line->>'qty')::int;
    v_price := coalesce((v_line->>'unit_price')::numeric, (select unit_price from public.products where id=v_sku));
    if v_qty <= 0 then raise exception 'Quantity must be positive'; end if;
    v_onhand := public.get_on_hand(p_consignee, v_sku);
    if v_qty > v_onhand then
      raise exception 'OVERSELL: % wants % but only % on hand', (select sku from public.products where id=v_sku), v_qty, v_onhand using errcode='check_violation';
    end if;
    insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, unit_price, ref_type, actor_user_id, reason)
    values (p_consignee, v_sku, 'SALE', -v_qty, v_price, 'sale', auth.uid(), coalesce(p_source,'MANUAL'));
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- build_return_package — creates a RET- package and RETURN_OUT entries.
-- p_lines: [{"sku_id":uuid,"qty":int}]
-- ---------------------------------------------------------------------------
create or replace function public.build_return_package(p_consignor uuid, p_consignee uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pkg uuid; v_line jsonb; v_sku uuid; v_qty int; v_onhand int;
begin
  if not (public.is_admin() or p_consignee = public.current_store_id()) then
    raise exception 'Not authorized to build returns for this store' using errcode='insufficient_privilege';
  end if;
  insert into public.packages (pkg_code, direction, consignor_id, consignee_id, status, created_by)
  values (public.gen_pkg_code('RETURN'), 'RETURN', p_consignor, p_consignee, 'RETURN_IN_TRANSIT', auth.uid())
  returning id into v_pkg;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := (v_line->>'sku_id')::uuid; v_qty := (v_line->>'qty')::int;
    v_onhand := public.get_on_hand(p_consignee, v_sku);
    if v_qty <= 0 or v_qty > v_onhand then
      raise exception 'Return qty for % must be 1..% (on hand)', (select sku from public.products where id=v_sku), v_onhand using errcode='check_violation';
    end if;
    insert into public.package_lines (package_id, sku_id, qty_expected) values (v_pkg, v_sku, v_qty);
    insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id)
    values (p_consignee, v_sku, 'RETURN_OUT', -v_qty, 'package', v_pkg, auth.uid());
  end loop;
  return v_pkg;
end $$;

-- ---------------------------------------------------------------------------
-- resolve_dispute — release held stock or write it off
-- ---------------------------------------------------------------------------
create or replace function public.resolve_dispute(p_package_id uuid, p_sku uuid, p_qty int, p_received boolean)
returns void language plpgsql security definer set search_path = public as $$
declare pk public.packages;
begin
  select * into pk from public.packages where id=p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if not (public.is_admin() or pk.consignee_id = public.current_store_id()) then
    raise exception 'Not authorized' using errcode='insufficient_privilege';
  end if;
  if p_received then
    insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, actor_user_id, reason)
    values (pk.consignee_id, p_sku, 'DISPUTE_RELEASE', p_qty, 'package', pk.id, auth.uid(), 'resolved: received');
  end if; -- written off: stock stays out, no entry
  update public.packages set status='DELIVERED', updated_at=now()
    where id=p_package_id and not exists (
      select 1 from public.package_lines where package_id=p_package_id and qty_disputed>0 and sku_id<>p_sku);
end $$;

-- ---------------------------------------------------------------------------
-- adjust_stock — physical count correction; reason required
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(p_consignee uuid, p_sku uuid, p_qty int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or p_consignee = public.current_store_id()) then
    raise exception 'Not authorized' using errcode='insufficient_privilege';
  end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'A reason is required for an adjustment' using errcode='check_violation'; end if;
  insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, actor_user_id, reason)
  values (p_consignee, p_sku, 'ADJUSTMENT', p_qty, 'adjustment', auth.uid(), p_reason);
end $$;

-- ---------------------------------------------------------------------------
-- in-dispute view + settlement from the ledger
-- ---------------------------------------------------------------------------
create or replace view public.v_in_dispute as
  select consignee_id, sku_id, -coalesce(sum(qty),0)::int as qty
  from public.ledger_entries where entry_type in ('DISPUTE_HOLD','DISPUTE_RELEASE')
  group by consignee_id, sku_id;
grant select on public.v_in_dispute to authenticated;

-- settlement strictly from SALE ledger entries for a consignor+store+period
create or replace function public.generate_settlement_ledger(
  p_agreement_id uuid, p_period_start date, p_period_end date
) returns public.settlements
language plpgsql security definer set search_path = public as $$
declare a public.agreements; v_gross numeric; v_comm numeric; s public.settlements;
begin
  select * into a from public.agreements where id=p_agreement_id;
  if not found then raise exception 'agreement not found'; end if;

  -- gross = Σ sold qty × price for this store, SKUs of this consignor, in period
  select coalesce(sum((-le.qty) * le.unit_price),0) into v_gross
  from public.ledger_entries le join public.products p on p.id=le.sku_id
  where le.entry_type='SALE' and le.consignee_id=a.store_id and p.consignor_id=a.consignor_id
    and le.created_at::date between p_period_start and p_period_end;

  -- commission uses per-SKU override when present, else the agreement rate
  select coalesce(sum((-le.qty) * le.unit_price *
      coalesce(co.commission_pct, a.commission_pct)/100.0),0) into v_comm
  from public.ledger_entries le join public.products p on p.id=le.sku_id
  left join public.commission_overrides co on co.agreement_id=a.id and co.product_id=le.sku_id
  where le.entry_type='SALE' and le.consignee_id=a.store_id and p.consignor_id=a.consignor_id
    and le.created_at::date between p_period_start and p_period_end;

  insert into public.settlements (agreement_id, period_start, period_end, gross_sales, commission, returns_total, damage_total, net_payable, status)
  values (p_agreement_id, p_period_start, p_period_end, round(v_gross,2), round(v_comm,2), 0, 0, round(v_gross - v_comm,2), 'pending')
  returning * into s;
  return s;
end $$;

revoke execute on function public.create_outbound_package(uuid,uuid,jsonb) from anon;
revoke execute on function public.pos_sale(uuid,jsonb,text) from anon;
revoke execute on function public.receive_package(uuid,jsonb) from anon;
revoke execute on function public.build_return_package(uuid,uuid,jsonb) from anon;
