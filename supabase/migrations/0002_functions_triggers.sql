-- ConsignTrack — 0002 functions, triggers & transactional RPCs
-- The ledger's integrity lives here, not in the UI.

-- ===========================================================================
-- Append-only guard for stock_movements
-- ===========================================================================
create or replace function public.forbid_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_movements is append-only; corrections must be new adjustment rows'
    using errcode = 'restrict_violation';
end;
$$;

create trigger t_stock_movements_no_update
  before update on public.stock_movements
  for each row execute function public.forbid_movement_mutation();

create trigger t_stock_movements_no_delete
  before delete on public.stock_movements
  for each row execute function public.forbid_movement_mutation();

-- ===========================================================================
-- apply_stock_movement — the single writer of stock_levels.
-- SECURITY DEFINER so it maintains derived stock regardless of caller RLS,
-- while the ON CONFLICT upsert keeps it correct under concurrency (row lock).
-- Enforces BR1: stock can never go negative.
-- ===========================================================================
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resulting_qty integer;
begin
  insert into public.stock_levels (store_id, product_id, consignor_id, qty_on_hand)
  values (new.store_id, new.product_id, new.consignor_id, new.qty_delta)
  on conflict (store_id, product_id, consignor_id)
  do update set qty_on_hand = stock_levels.qty_on_hand + excluded.qty_on_hand
  returning stock_levels.qty_on_hand into resulting_qty;

  if resulting_qty < 0 then
    raise exception
      'BR1: insufficient stock (store=%, product=%, consignor=%): movement % would drop on-hand to %',
      new.store_id, new.product_id, new.consignor_id, new.qty_delta, resulting_qty
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger t_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ===========================================================================
-- Identity / role helpers (SECURITY DEFINER, read app_users for auth.uid()).
-- Used throughout RLS. Kept stable + minimal.
-- ===========================================================================
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.app_users where auth_user_id = auth.uid();
$$;

create or replace function public.current_consignor_id()
returns uuid language sql stable security definer set search_path = public as $$
  select consignor_id from public.app_users where auth_user_id = auth.uid();
$$;

create or replace function public.current_store_id()
returns uuid language sql stable security definer set search_path = public as $$
  select store_id from public.app_users where auth_user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create or replace function public.is_consignor_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'consignor', false);
$$;

create or replace function public.is_store_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('store_manager', 'store_staff'), false);
$$;

create or replace function public.is_store_manager_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('store_manager', 'admin'), false);
$$;

-- ===========================================================================
-- Price / commission change audit (BR8) — prospective, logged, never silent.
-- ===========================================================================
create or replace function public.audit_price_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.unit_price is distinct from old.unit_price then
    insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
    values ('products', new.id, 'unit_price', old.unit_price::text, new.unit_price::text, auth.uid());
  end if;
  return new;
end;
$$;

create trigger t_products_price_audit
  after update of unit_price on public.products
  for each row execute function public.audit_price_change();

create or replace function public.audit_commission_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.commission_pct is distinct from old.commission_pct then
    insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
    values ('agreements', new.id, 'commission_pct', old.commission_pct::text, new.commission_pct::text, auth.uid());
  end if;
  return new;
end;
$$;

create trigger t_agreements_commission_audit
  after update of commission_pct on public.agreements
  for each row execute function public.audit_commission_change();

-- ===========================================================================
-- confirm_delivery (BR4) — a delivery becomes sellable stock only here.
-- Runs as invoker: RLS must permit the caller to update the delivery + insert
-- stock_movements for its store. A store user (their store) or admin qualifies.
-- ===========================================================================
create or replace function public.confirm_delivery(p_delivery_id uuid)
returns public.deliveries
language plpgsql
as $$
declare
  d public.deliveries;
  it record;
begin
  select * into d from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'delivery % not found', p_delivery_id using errcode = 'no_data_found';
  end if;
  if d.status = 'confirmed' then
    raise exception 'delivery % is already confirmed', p_delivery_id using errcode = 'raise_exception';
  end if;

  update public.deliveries
     set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
   where id = p_delivery_id
  returning * into d;

  for it in
    select product_id, qty, unit_price from public.delivery_items where delivery_id = p_delivery_id
  loop
    insert into public.stock_movements
      (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by)
    values
      ('delivery', p_delivery_id, 'delivery', it.qty, d.store_id, it.product_id, d.consignor_id, auth.uid());
  end loop;

  return d;
end;
$$;

-- ===========================================================================
-- record_sale — fast path for the store's sale entry screen.
-- lines: jsonb array of { product_id, qty, unit_price? }.
-- BR1 (no oversell) is enforced by the stock_movements trigger; BR2 keeps
-- consignor attribution via the product. Returns the new sale id.
-- ===========================================================================
create or replace function public.record_sale(
  p_store_id uuid,
  p_lines jsonb,
  p_sold_at timestamptz default now()
)
returns uuid
language plpgsql
as $$
declare
  v_sale_id uuid;
  ln jsonb;
  v_product_id uuid;
  v_consignor_id uuid;
  v_qty integer;
  v_price numeric(12,2);
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'a sale needs at least one line item' using errcode = 'raise_exception';
  end if;

  insert into public.sales (store_id, sold_at, recorded_by)
  values (p_store_id, coalesce(p_sold_at, now()), auth.uid())
  returning id into v_sale_id;

  for ln in select * from jsonb_array_elements(p_lines)
  loop
    v_product_id := (ln->>'product_id')::uuid;
    v_qty := (ln->>'qty')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'line qty must be positive' using errcode = 'check_violation';
    end if;

    select consignor_id, unit_price into v_consignor_id, v_price
      from public.products where id = v_product_id;
    if v_consignor_id is null then
      raise exception 'unknown product %', v_product_id using errcode = 'no_data_found';
    end if;
    -- honour an explicit price if supplied, else the current catalogue price
    v_price := coalesce((ln->>'unit_price')::numeric, v_price);

    insert into public.sale_items (sale_id, product_id, consignor_id, qty, unit_price)
    values (v_sale_id, v_product_id, v_consignor_id, v_qty, v_price);

    insert into public.stock_movements
      (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by)
    values
      ('sale', v_sale_id, 'sale', -v_qty, p_store_id, v_product_id, v_consignor_id, auth.uid());
  end loop;

  return v_sale_id;
end;
$$;

-- ===========================================================================
-- record_return (BR6) — reduces stock, does NOT reverse recorded sales.
-- ===========================================================================
create or replace function public.record_return(
  p_store_id uuid,
  p_product_id uuid,
  p_consignor_id uuid,
  p_qty integer,
  p_reason text default null,
  p_return_date date default current_date
)
returns uuid
language plpgsql
as $$
declare
  v_return_id uuid;
begin
  if p_qty <= 0 then
    raise exception 'return qty must be positive' using errcode = 'check_violation';
  end if;

  insert into public.returns (store_id, product_id, consignor_id, qty, reason, return_date)
  values (p_store_id, p_product_id, p_consignor_id, p_qty, p_reason, p_return_date)
  returning id into v_return_id;

  insert into public.stock_movements
    (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, created_by)
  values
    ('return', v_return_id, 'return', -p_qty, p_store_id, p_product_id, p_consignor_id, auth.uid());

  return v_return_id;
end;
$$;

-- ===========================================================================
-- adjust_stock — the ONLY sanctioned correction path (append-only, audited).
-- Manager/admin only (also enforced by stock_movements RLS insert policy).
-- ===========================================================================
create or replace function public.adjust_stock(
  p_store_id uuid,
  p_product_id uuid,
  p_consignor_id uuid,
  p_qty_delta integer,
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if not (public.is_store_manager_or_admin()) then
    raise exception 'only store_manager/admin may adjust stock' using errcode = 'insufficient_privilege';
  end if;

  insert into public.stock_movements
    (entity_type, entity_id, movement_type, qty_delta, store_id, product_id, consignor_id, note, created_by)
  values
    ('adjustment', null, 'adjustment', p_qty_delta, p_store_id, p_product_id, p_consignor_id, p_note, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ===========================================================================
-- generate_settlement (BR3, BR5) — auto-compute a period statement.
--   gross_sales     = Σ (qty_sold × unit_price at sale) for the pair in period
--   commission      = gross_sales × commission_pct/100  (active agreement)
--   returns_total   = Σ (return qty × current unit_price) in period
--   net_payable     = gross_sales − commission − returns_total
-- Idempotent per (agreement, period): replaces an existing pending statement.
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
  v_net numeric(12,2) := 0;
  s public.settlements;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'no_data_found';
  end if;

  -- gross sales for this consignor at this store within the period
  select coalesce(sum(si.qty * si.unit_price), 0)
    into v_gross
    from public.sale_items si
    join public.sales sa on sa.id = si.sale_id
   where sa.store_id = a.store_id
     and si.consignor_id = a.consignor_id
     and sa.sold_at::date between p_period_start and p_period_end;

  -- returns value in the period (qty × current catalogue price)
  select coalesce(sum(r.qty * p.unit_price), 0)
    into v_returns
    from public.returns r
    join public.products p on p.id = r.product_id
   where r.store_id = a.store_id
     and r.consignor_id = a.consignor_id
     and r.return_date between p_period_start and p_period_end;

  v_commission := round(v_gross * a.commission_pct / 100.0, 2);
  v_net := v_gross - v_commission - v_returns;

  -- replace any existing pending statement for the same window
  delete from public.settlements
   where agreement_id = p_agreement_id
     and period_start = p_period_start
     and period_end = p_period_end
     and status = 'pending';

  insert into public.settlements
    (agreement_id, period_start, period_end, gross_sales, commission, returns_total, net_payable, status)
  values
    (p_agreement_id, p_period_start, p_period_end, v_gross, v_commission, v_returns, v_net, 'pending')
  returning * into s;

  -- per-product settlement lines
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

-- ===========================================================================
-- mark_settlement_paid — store side of BR7. Records paid_at, status -> 'paid'.
-- ===========================================================================
create or replace function public.mark_settlement_paid(p_settlement_id uuid)
returns public.settlements
language plpgsql
as $$
declare
  s public.settlements;
  v_payment_id uuid;
begin
  select * into s from public.settlements where id = p_settlement_id for update;
  if not found then
    raise exception 'settlement % not found', p_settlement_id using errcode = 'no_data_found';
  end if;

  select id into v_payment_id from public.payments where settlement_id = p_settlement_id limit 1;
  if v_payment_id is null then
    insert into public.payments (settlement_id, amount, paid_at)
    values (p_settlement_id, s.net_payable, now());
  else
    update public.payments set amount = s.net_payable, paid_at = now() where id = v_payment_id;
  end if;

  update public.settlements set status = 'paid' where id = p_settlement_id returning * into s;
  return s;
end;
$$;

-- ===========================================================================
-- confirm_payment_received — consignor side of BR7. Sets confirmed_at; the
-- settlement is 'confirmed' only when BOTH paid_at and confirmed_at exist.
-- ===========================================================================
create or replace function public.confirm_payment_received(p_settlement_id uuid)
returns public.settlements
language plpgsql
as $$
declare
  s public.settlements;
  pmt public.payments;
begin
  select * into s from public.settlements where id = p_settlement_id for update;
  if not found then
    raise exception 'settlement % not found', p_settlement_id using errcode = 'no_data_found';
  end if;

  select * into pmt from public.payments where settlement_id = p_settlement_id limit 1;
  if pmt.id is null or pmt.paid_at is null then
    raise exception 'BR7: cannot confirm receipt before the store has marked payment paid'
      using errcode = 'raise_exception';
  end if;

  update public.payments set confirmed_at = now() where id = pmt.id;
  update public.settlements set status = 'confirmed' where id = p_settlement_id returning * into s;
  return s;
end;
$$;
