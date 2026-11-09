-- ConsignTrack — 0014 commercial terms (closes the 5 open questions in docs/ARCHITECTURE.md)
--   Q1 per-product commission overrides        -> commission_overrides
--   Q2 end-of-period policy                     -> agreements.end_of_period_action + knobs
--   Q3 damage liability                         -> agreements.damage_liability + split
--   Q4 consignment period                       -> agreements.consignment_period_days + items.display_expires_at
--   Q5 partial-receipt grace                    -> agreements.receipt_grace_days (swept by 0015 RPC)
-- All columns carry defaults so existing rows are backfilled automatically.

-- ---------------------------------------------------------------------------
-- Q2/Q3/Q4/Q5 — commercial terms on the agreement
-- ---------------------------------------------------------------------------
alter table public.agreements
  add column if not exists damage_liability text not null default 'consignor'
    check (damage_liability in ('consignor', 'store', 'shared')),
  -- store's share of a loss when liability is 'shared' (consignor absorbs the rest)
  add column if not exists damage_store_share_pct numeric(5,2) not null default 50
    check (damage_store_share_pct >= 0 and damage_store_share_pct <= 100),
  add column if not exists consignment_period_days integer not null default 60
    check (consignment_period_days > 0),
  add column if not exists end_of_period_action text not null default 'return'
    check (end_of_period_action in ('return', 'extend', 'discount')),
  -- how many extra days 'extend' / 'discount' grant past expiry
  add column if not exists grace_extend_days integer not null default 30
    check (grace_extend_days > 0),
  -- markdown applied to asking_price when end_of_period_action = 'discount'
  add column if not exists markdown_pct numeric(5,2) not null default 20
    check (markdown_pct >= 0 and markdown_pct <= 100),
  -- Q5: a 'sent' delivery with unreceived items is auto-closed after this many days
  add column if not exists receipt_grace_days integer not null default 14
    check (receipt_grace_days > 0);

-- ---------------------------------------------------------------------------
-- Q3 — settlements record the damage deduction explicitly
-- ---------------------------------------------------------------------------
alter table public.settlements
  add column if not exists damage_total numeric(12,2) not null default 0;

-- ---------------------------------------------------------------------------
-- Q4 — the concrete display window is pinned on the item at receipt
-- ---------------------------------------------------------------------------
alter table public.items
  add column if not exists display_expires_at timestamptz;

create index if not exists items_display_expires_idx
  on public.items (display_expires_at)
  where status in ('received_confirmed', 'listed');

-- ---------------------------------------------------------------------------
-- Q1 — per-product commission overrides (null anywhere -> fall back to flat rate)
-- ---------------------------------------------------------------------------
create table if not exists public.commission_overrides (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  commission_pct numeric(5,2) not null
    check (commission_pct >= 0 and commission_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, product_id)
);

create index if not exists commission_overrides_agreement_idx
  on public.commission_overrides (agreement_id);

create trigger t_commission_overrides_updated
  before update on public.commission_overrides
  for each row execute function public.set_updated_at();

-- prospective-only audit, consistent with agreements.commission_pct (BR8)
create or replace function public.audit_override_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.commission_pct is distinct from old.commission_pct then
    insert into public.audit_log (table_name, row_id, field, old_value, new_value, changed_by)
    values ('commission_overrides', new.id, 'commission_pct', old.commission_pct::text, new.commission_pct::text, auth.uid());
  end if;
  return new;
end; $$;

create trigger t_commission_overrides_audit
  after update of commission_pct on public.commission_overrides
  for each row execute function public.audit_override_change();

-- ---------------------------------------------------------------------------
-- RLS — an override is visible/editable to the two partners on its agreement
-- ---------------------------------------------------------------------------
alter table public.commission_overrides enable row level security;

create policy commission_overrides_select on public.commission_overrides
  for select using (
    public.is_admin() or exists (
      select 1 from public.agreements a
      where a.id = commission_overrides.agreement_id
        and (a.consignor_id = public.current_consignor_id()
             or a.store_id = public.current_store_id())
    )
  );

create policy commission_overrides_write on public.commission_overrides
  for all using (
    public.is_admin() or exists (
      select 1 from public.agreements a
      where a.id = commission_overrides.agreement_id
        and (a.consignor_id = public.current_consignor_id()
             or a.store_id = public.current_store_id())
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.agreements a
      where a.id = commission_overrides.agreement_id
        and (a.consignor_id = public.current_consignor_id()
             or a.store_id = public.current_store_id())
    )
  );
