-- ConsignTrack — 0004 reconciliation & discrepancy verification
-- These functions run as INVOKER, so a store/consignor sees only their own
-- rows (RLS applies); the verify script uses service_role to check globally.

-- ===========================================================================
-- reconcile_stock (BR5 core) — every triple's stock_levels.qty_on_hand must
-- equal the running sum of its stock_movements. Returns ONLY mismatches, so
-- zero rows == a perfectly reconciled ledger.
-- ===========================================================================
create or replace function public.reconcile_stock()
returns table (
  store_id uuid,
  product_id uuid,
  consignor_id uuid,
  level_qty integer,
  movement_sum bigint,
  diff bigint
)
language sql
stable
as $$
  with sums as (
    select m.store_id, m.product_id, m.consignor_id, sum(m.qty_delta)::bigint as movement_sum
      from public.stock_movements m
     group by m.store_id, m.product_id, m.consignor_id
  )
  select
    coalesce(sl.store_id, s.store_id),
    coalesce(sl.product_id, s.product_id),
    coalesce(sl.consignor_id, s.consignor_id),
    coalesce(sl.qty_on_hand, 0),
    coalesce(s.movement_sum, 0),
    coalesce(sl.qty_on_hand, 0) - coalesce(s.movement_sum, 0)
  from public.stock_levels sl
  full outer join sums s
    on s.store_id = sl.store_id
   and s.product_id = sl.product_id
   and s.consignor_id = sl.consignor_id
  where coalesce(sl.qty_on_hand, 0) <> coalesce(s.movement_sum, 0);
$$;

-- ===========================================================================
-- reconcile_period (BR5) — opening + deliveries − sales − returns = closing
-- for every (store, product, consignor) over a window. `reconciles` is false
-- when adjustments moved stock outside the delivery/sale/return flow.
-- ===========================================================================
create or replace function public.reconcile_period(p_start date, p_end date)
returns table (
  store_id uuid,
  product_id uuid,
  consignor_id uuid,
  opening bigint,
  deliveries bigint,
  sales bigint,
  returns bigint,
  adjustments bigint,
  closing bigint,
  expected_closing bigint,
  reconciles boolean
)
language sql
stable
as $$
  select
    m.store_id,
    m.product_id,
    m.consignor_id,
    coalesce(sum(m.qty_delta) filter (where m.created_at::date < p_start), 0) as opening,
    coalesce(sum(m.qty_delta) filter (where m.movement_type = 'delivery'   and m.created_at::date between p_start and p_end), 0) as deliveries,
    coalesce(-sum(m.qty_delta) filter (where m.movement_type = 'sale'      and m.created_at::date between p_start and p_end), 0) as sales,
    coalesce(-sum(m.qty_delta) filter (where m.movement_type = 'return'    and m.created_at::date between p_start and p_end), 0) as returns,
    coalesce(sum(m.qty_delta) filter (where m.movement_type = 'adjustment' and m.created_at::date between p_start and p_end), 0) as adjustments,
    coalesce(sum(m.qty_delta) filter (where m.created_at::date <= p_end), 0) as closing,
    (
      coalesce(sum(m.qty_delta) filter (where m.created_at::date < p_start), 0)
      + coalesce(sum(m.qty_delta) filter (where m.movement_type = 'delivery' and m.created_at::date between p_start and p_end), 0)
      + coalesce(sum(m.qty_delta) filter (where m.movement_type = 'sale'     and m.created_at::date between p_start and p_end), 0)
      + coalesce(sum(m.qty_delta) filter (where m.movement_type = 'return'   and m.created_at::date between p_start and p_end), 0)
    ) as expected_closing,
    (
      coalesce(sum(m.qty_delta) filter (where m.movement_type = 'adjustment' and m.created_at::date between p_start and p_end), 0) = 0
    ) as reconciles
  from public.stock_movements m
  group by m.store_id, m.product_id, m.consignor_id;
$$;

-- ===========================================================================
-- find_discrepancies (BR9) — the anomaly feed. Surfaces:
--   * unexplained_shrinkage : a negative 'adjustment' (stock dropped with no
--                             matching sale or return)
--   * level_mismatch        : stock_levels disagrees with the movement sum
-- ===========================================================================
create or replace function public.find_discrepancies()
returns table (
  kind text,
  store_id uuid,
  product_id uuid,
  consignor_id uuid,
  qty integer,
  detail text,
  occurred_at timestamptz
)
language sql
stable
as $$
  select
    'unexplained_shrinkage'::text as kind,
    m.store_id, m.product_id, m.consignor_id,
    m.qty_delta as qty,
    coalesce(m.note, 'Stock reduced by an adjustment with no matching sale or return') as detail,
    m.created_at as occurred_at
  from public.stock_movements m
  where m.movement_type = 'adjustment' and m.qty_delta < 0

  union all

  select
    'level_mismatch'::text as kind,
    r.store_id, r.product_id, r.consignor_id,
    r.diff::int as qty,
    'stock_levels (' || r.level_qty::text || ') != sum of movements (' || r.movement_sum::text || ')' as detail,
    now() as occurred_at
  from public.reconcile_stock() r

  order by occurred_at desc;
$$;

grant execute on all functions in schema public to authenticated;
