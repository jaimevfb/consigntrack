-- ConsignTrack — 0001 schema
-- Core tables for a shared consignment ledger. snake_case, uuid PKs,
-- created_at / updated_at on every table (stock_movements is append-only:
-- created_at only, never updated).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- consignors — the producers who place goods
-- ---------------------------------------------------------------------------
create table public.consignors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  type text not null default 'artisan'
    check (type in ('artisan', 'producer', 'manufacturer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stores — the consignees who hold and sell goods
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  manager text,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_users — maps a Supabase auth user to a role + scope
-- ---------------------------------------------------------------------------
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null
    check (role in ('consignor', 'store_manager', 'store_staff', 'admin')),
  consignor_id uuid references public.consignors (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- role/scope integrity: consignors carry a consignor_id, store roles a store_id
  constraint app_users_scope_chk check (
    (role = 'consignor'     and consignor_id is not null and store_id is null) or
    (role in ('store_manager', 'store_staff') and store_id is not null and consignor_id is null) or
    (role = 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- agreements — one active commercial agreement per (consignor, store)
-- ---------------------------------------------------------------------------
create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.consignors (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  commission_pct numeric(5, 2) not null default 0
    check (commission_pct >= 0 and commission_pct <= 100),
  settlement_cadence text not null default 'monthly'
    check (settlement_cadence in ('weekly', 'monthly', 'quarterly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- at most one ACTIVE agreement per consignor+store pair
create unique index agreements_active_pair_uidx
  on public.agreements (consignor_id, store_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- products — a consignor's catalogue
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.consignors (id) on delete cascade,
  name text not null,
  sku text,
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consignor_id, sku)
);

-- ---------------------------------------------------------------------------
-- deliveries — a consignment shipment; becomes stock only when 'confirmed'
-- ---------------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.consignors (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  agreement_id uuid references public.agreements (id) on delete set null,
  delivery_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'confirmed')),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stock_levels — derived, kept correct by triggers; unique (store,product,consignor)
-- ---------------------------------------------------------------------------
create table public.stock_levels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  consignor_id uuid not null references public.consignors (id) on delete cascade,
  qty_on_hand integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, product_id, consignor_id)
);

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  sold_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  consignor_id uuid not null references public.consignors (id),
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- returns
-- ---------------------------------------------------------------------------
create table public.returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id),
  consignor_id uuid not null references public.consignors (id),
  qty integer not null check (qty > 0),
  reason text,
  return_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- settlements + lines + payments
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_sales numeric(12, 2) not null default 0,
  commission numeric(12, 2) not null default 0,
  returns_total numeric(12, 2) not null default 0,
  net_payable numeric(12, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty_sold integer not null default 0,
  gross numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  paid_at timestamptz,       -- set when the store marks it paid
  confirmed_at timestamptz,  -- set when the consignor confirms receipt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stock_movements — APPEND-ONLY audit trail; qty_on_hand is the running sum
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  entity_type text,   -- 'delivery' | 'sale' | 'return' | 'adjustment'
  entity_id uuid,     -- id of the source row (delivery, sale, return...)
  movement_type text not null
    check (movement_type in ('delivery', 'sale', 'return', 'adjustment')),
  qty_delta integer not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  consignor_id uuid not null references public.consignors (id) on delete cascade,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log — records prospective price / commission changes (BR8)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- indexes for the hot read paths (dashboards, ledger scans)
-- ---------------------------------------------------------------------------
create index app_users_auth_idx        on public.app_users (auth_user_id);
create index products_consignor_idx    on public.products (consignor_id);
create index agreements_consignor_idx  on public.agreements (consignor_id);
create index agreements_store_idx      on public.agreements (store_id);
create index deliveries_consignor_idx  on public.deliveries (consignor_id);
create index deliveries_store_idx      on public.deliveries (store_id);
create index delivery_items_delivery_idx on public.delivery_items (delivery_id);
create index stock_levels_store_idx    on public.stock_levels (store_id);
create index stock_levels_consignor_idx on public.stock_levels (consignor_id);
create index sales_store_idx           on public.sales (store_id);
create index sale_items_sale_idx       on public.sale_items (sale_id);
create index sale_items_consignor_idx  on public.sale_items (consignor_id);
create index sale_items_product_idx    on public.sale_items (product_id);
create index returns_store_idx         on public.returns (store_id);
create index returns_consignor_idx     on public.returns (consignor_id);
create index settlements_agreement_idx on public.settlements (agreement_id);
create index settlement_lines_settlement_idx on public.settlement_lines (settlement_id);
create index payments_settlement_idx   on public.payments (settlement_id);
create index stock_movements_triple_idx on public.stock_movements (store_id, product_id, consignor_id);
create index stock_movements_consignor_idx on public.stock_movements (consignor_id);
create index stock_movements_created_idx on public.stock_movements (created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers (every table except append-only stock_movements/audit_log)
-- ---------------------------------------------------------------------------
create trigger t_consignors_updated       before update on public.consignors      for each row execute function public.set_updated_at();
create trigger t_stores_updated           before update on public.stores          for each row execute function public.set_updated_at();
create trigger t_app_users_updated        before update on public.app_users       for each row execute function public.set_updated_at();
create trigger t_agreements_updated       before update on public.agreements      for each row execute function public.set_updated_at();
create trigger t_products_updated         before update on public.products        for each row execute function public.set_updated_at();
create trigger t_deliveries_updated       before update on public.deliveries      for each row execute function public.set_updated_at();
create trigger t_delivery_items_updated   before update on public.delivery_items  for each row execute function public.set_updated_at();
create trigger t_stock_levels_updated     before update on public.stock_levels    for each row execute function public.set_updated_at();
create trigger t_sales_updated            before update on public.sales           for each row execute function public.set_updated_at();
create trigger t_sale_items_updated       before update on public.sale_items      for each row execute function public.set_updated_at();
create trigger t_returns_updated          before update on public.returns         for each row execute function public.set_updated_at();
create trigger t_settlements_updated      before update on public.settlements     for each row execute function public.set_updated_at();
create trigger t_settlement_lines_updated before update on public.settlement_lines for each row execute function public.set_updated_at();
create trigger t_payments_updated         before update on public.payments        for each row execute function public.set_updated_at();
