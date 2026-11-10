-- ConsignTrack — 0018 two-tier model: Package QR (logistics) + SKU ledger (stock)
-- Phase 1 of the consignee refactor. ADDITIVE: the legacy item/stock tables stay
-- in place so the app keeps building; Phase 2/4 remove and rewire them.
--
-- DEVIATION FROM PROMPT (documented in docs/REFACTOR_NOTES.md): opening balances
-- are seeded from stock_levels (the real quantity source — e.g. Kultura = 27),
-- not from the sparse unit `items` table, which never held true quantities.

-- ---------------------------------------------------------------------------
-- Evolve existing tables (minimal, additive)
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists status text not null default 'active';
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('active','archived'));

alter table public.agreements add column if not exists effective_from timestamptz not null default now();

alter table public.sale_items add column if not exists source text not null default 'MANUAL';
alter table public.sale_items drop constraint if exists sale_items_source_check;
alter table public.sale_items add constraint sale_items_source_check check (source in ('POS_SCAN','MANUAL','CSV_IMPORT'));

alter table public.settlements add column if not exists payment_proof_url text;

-- ---------------------------------------------------------------------------
-- packages — license-plate unit for bulk logistics (one scan moves the box)
-- ---------------------------------------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  pkg_code text unique not null,
  direction text not null check (direction in ('OUTBOUND','RETURN')),
  consignor_id uuid not null references public.consignors(id),
  consignee_id uuid not null references public.stores(id),
  status text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  in_transit_at timestamptz,
  settled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.package_lines (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  sku_id uuid not null references public.products(id),
  qty_expected int not null check (qty_expected >= 0),
  qty_received int,
  qty_disputed int not null default 0,
  dispute_photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists package_lines_package_idx on public.package_lines(package_id);

-- ---------------------------------------------------------------------------
-- ledger_entries — append-only single source of truth for on-hand stock
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  consignee_id uuid not null references public.stores(id),
  sku_id uuid not null references public.products(id),
  entry_type text not null check (entry_type in
    ('RECEIVE','SALE','RETURN_OUT','DISPUTE_HOLD','DISPUTE_RELEASE','ADJUSTMENT')),
  qty int not null,
  ref_type text,
  ref_id uuid,
  actor_user_id uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_consignee_sku_idx on public.ledger_entries(consignee_id, sku_id);

-- Append-only: no UPDATE or DELETE, ever. Corrections are reversal entries.
create or replace function public.block_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only; post a reversal entry instead'
    using errcode = 'restrict_violation';
end $$;
drop trigger if exists trg_ledger_no_update on public.ledger_entries;
drop trigger if exists trg_ledger_no_delete on public.ledger_entries;
create trigger trg_ledger_no_update before update on public.ledger_entries
  for each row execute function public.block_ledger_mutation();
create trigger trg_ledger_no_delete before delete on public.ledger_entries
  for each row execute function public.block_ledger_mutation();

-- ---------------------------------------------------------------------------
-- The one formula — on_hand(sku, consignee) = Σ ledger_entries.qty
-- ---------------------------------------------------------------------------
create or replace view public.v_on_hand as
  select consignee_id, sku_id, coalesce(sum(qty), 0)::int as qty
  from public.ledger_entries
  group by consignee_id, sku_id;

create or replace function public.get_on_hand(p_consignee uuid, p_sku uuid)
returns int language sql stable as $$
  select coalesce(sum(qty), 0)::int
  from public.ledger_entries
  where consignee_id = p_consignee and sku_id = p_sku;
$$;

-- ---------------------------------------------------------------------------
-- RLS — reads scoped to the party; writes go only through SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
alter table public.packages enable row level security;
alter table public.package_lines enable row level security;
alter table public.ledger_entries enable row level security;

drop policy if exists packages_select on public.packages;
create policy packages_select on public.packages for select to authenticated
  using (public.is_admin() or consignee_id = public.current_store_id() or consignor_id = public.current_consignor_id());

drop policy if exists package_lines_select on public.package_lines;
create policy package_lines_select on public.package_lines for select to authenticated
  using (exists (select 1 from public.packages p where p.id = package_lines.package_id
    and (public.is_admin() or p.consignee_id = public.current_store_id() or p.consignor_id = public.current_consignor_id())));

drop policy if exists ledger_select on public.ledger_entries;
create policy ledger_select on public.ledger_entries for select to authenticated
  using (public.is_admin() or consignee_id = public.current_store_id()
    or sku_id in (select id from public.products where consignor_id = public.current_consignor_id()));

grant select on public.v_on_hand to authenticated;

-- ---------------------------------------------------------------------------
-- Placeholder junk product "123": archive it (the legacy append-only
-- stock_movements guard blocks a hard delete, and legacy tables still FK it).
-- It has 0 stock, so it never enters the new ledger. Phase 2 removes it fully
-- when the legacy tables are dropped.
-- ---------------------------------------------------------------------------
update public.products set status = 'archived' where name = '123';

-- ---------------------------------------------------------------------------
-- Opening balances — one ADJUSTMENT entry per SKU/consignee from real stock.
-- Re-runnable: guarded so it never double-posts.
-- ---------------------------------------------------------------------------
do $$
declare v_count int;
begin
  insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, reason)
  select sl.store_id, sl.product_id, 'ADJUSTMENT', sl.qty_on_hand, 'migration',
         'migration from unit serialization'
  from public.stock_levels sl
  where sl.qty_on_hand <> 0
    and exists (select 1 from public.products p where p.id = sl.product_id)
    and not exists (
      select 1 from public.ledger_entries le
      where le.consignee_id = sl.store_id and le.sku_id = sl.product_id and le.ref_type = 'migration'
    );
  get diagnostics v_count = row_count;
  raise notice 'opening balances posted: % rows', v_count;
end $$;
