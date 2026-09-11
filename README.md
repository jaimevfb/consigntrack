# ConsignTrack

A web-based **consignment inventory and settlement ledger** for Philippine MSME
retail. A producer (the **consignor**) places goods in a store (the
**consignee/store**) and is paid after items sell, minus commission, with unsold
goods returned. ConsignTrack replaces two out-of-sync manual record sets with
**one shared ledger**: the consignor sees all their stores, each store sees all
its consignors, and both read the same numbers.

The guiding invariant, enforced in the database:

```
opening stock + confirmed deliveries − sales − returns = current stock on hand
```

Every stock movement is traceable to a delivery, a sale, a return, or an
adjustment, and the ledger always reconciles.

---

## Stack

- **Next.js 14** (App Router, TypeScript, React Server Components)
- **Supabase** — Postgres, Auth (email/password), **Row-Level Security**
- **Tailwind CSS** + shadcn/ui-style components
- **Zod** validation, **React Hook Form**-friendly client forms
- **Vitest** for business-rule tests
- Deploy target **Vercel**

Security is enforced **server-side in the database** via RLS — the UI is never
trusted. `stock_movements` is an append-only audit trail.

---

## Prerequisites

- Node 18+ (works on 20/22/26)
- [Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker
  (for the local stack), **or** a hosted Supabase project

---

## Quick start (local, Supabase CLI)

```bash
# 1. Install dependencies
npm install

# 2. Start the local Supabase stack (Postgres, Auth, Studio) — requires Docker
supabase start

# 3. Apply migrations (schema, triggers, RLS, reconciliation, demo-reset)
supabase db reset            # runs everything in supabase/migrations in order

# 4. Configure env — copy the keys printed by `supabase start`
cp .env.example .env.local
cp .env.example .env         # the seed/verify scripts read .env
#   set NEXT_PUBLIC_SUPABASE_URL          (e.g. http://127.0.0.1:54321)
#   set NEXT_PUBLIC_SUPABASE_ANON_KEY     (anon key from `supabase start`)
#   set SUPABASE_SERVICE_ROLE_KEY         (service_role key from `supabase start`)

# 5. Seed demo data (creates users, deliveries, sales, an overdue settlement,
#    and one seeded discrepancy). Prints demo logins.
npm run seed

# 6. (optional) Verify RLS tenant isolation from real signed-in users
npm run db:verify

# 7. Run the app
npm run dev                  # http://localhost:3000
```

> `supabase start` prints the API URL and the `anon` / `service_role` keys. Use
> those exact values in your env files.

---

## Demo logins

Printed by `npm run seed`, also here:

| Role          | Email                       | Password       | Scope                                   |
| ------------- | --------------------------- | -------------- | --------------------------------------- |
| Admin         | `admin@consigntrack.test`   | `admin123`     | Everything; reconciliation + audit      |
| Consignor     | `maria@consigntrack.test`   | `consignor123` | Maria's Weaves (all stores)             |
| Store manager | `kultura@consigntrack.test` | `store123`     | Kultura — SM Aura                       |
| Store manager | `baguio@consigntrack.test`  | `store123`     | Baguio Pasalubong Center (**overdue**)  |
| Store manager | `ilocos@consigntrack.test`  | `store123`     | Ilocos Craft Corner (**discrepancy**)   |
| Store staff   | `staff@consigntrack.test`   | `staff123`     | Kultura, restricted (no price edits)    |

Sign in as **maria** to see the consignor dashboard across all three stores; as
**baguio** to see an overdue settlement; as **ilocos** to see the seeded stock
discrepancy in the anomaly feed; as **admin** for the reconciliation console.

---

## Tests

```bash
npm test          # Vitest — business rules BR1, BR3, BR5, BR7
npm run typecheck # tsc --noEmit
npm run build     # production build
```

The business-rule tests in `src/lib/business.test.ts` verify the same maths the
SQL enforces:

- **BR1** no oversell (`canFulfillSale`)
- **BR3** `net_payable = gross − commission − returns` (`computeNetPayable`)
- **BR5** reconciliation identity (`reconcile`)
- **BR7** payment closed only when paid **and** received (`isPaymentConfirmed`)

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Create a hosted Supabase project. Apply the migrations:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
3. Seed the hosted project (from your machine, with hosted keys in `.env`):
   ```bash
   npm run seed
   ```
4. Import the repo into Vercel and set the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; used only by scripts — you do not
     need it in Vercel unless you run the seed there)
5. In Supabase Auth settings, add your Vercel URL to the allowed redirect URLs.

Never commit secrets — only `.env.example` is tracked.

---

## Data model & rules

Migrations live in `supabase/migrations` and run in order:

| File                          | Contents                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `0001_schema.sql`             | All tables, constraints, indexes, `updated_at` triggers        |
| `0002_functions_triggers.sql` | Stock-movement trigger (BR1), append-only guard, RPCs, BR8 audit |
| `0003_rls.sql`                | Row-Level Security policies for every table                    |
| `0004_reconciliation.sql`     | `reconcile_stock`, `reconcile_period` (BR5), `find_discrepancies` (BR9) |
| `0005_demo_reset.sql`         | `reset_demo()` — service-role only, used by the seed           |

### Business rules (enforced in the DB)

- **BR1** A sale/return can never drive stock below zero — enforced by the
  `stock_movements` insert trigger (`apply_stock_movement`).
- **BR2** Title stays with the consignor until sale — all stock is tagged with
  `consignor_id`; there is no ownership transfer, only a sale event.
- **BR3** `net_payable = gross_sales − commission − returns_total`, commission
  from the active agreement — `generate_settlement`.
- **BR4** Delivery items become sellable stock **only** when the store confirms —
  `confirm_delivery`; draft/sent deliveries do not count toward stock.
- **BR5** `reconcile_stock()` returns zero rows when every `stock_levels` row
  equals the sum of its movements; `reconcile_period()` checks
  `opening + deliveries − sales − returns = closing`.
- **BR6** A return reduces stock but never reverses recorded sales.
- **BR7** A payment is `confirmed` only when both `paid_at` (store) and
  `confirmed_at` (consignor) are set — `mark_settlement_paid` +
  `confirm_payment_received`.
- **BR8** Only `store_manager`/`admin` change commissions/agreements; consignors
  own their catalogue prices; **store_staff cannot** — enforced by RLS. Every
  price/commission change is logged to `audit_log`.
- **BR9** `find_discrepancies()` surfaces unexplained shrinkage (negative
  adjustments) and any level/movement mismatch — shown in the anomaly feed.

### Roles (RLS)

- **admin** — full access.
- **consignor** — only rows where `consignor_id` = their consignor (all stores).
- **store_manager** — their store (all consignors), incl. commissions/agreements.
- **store_staff** — their store, but **not** prices, commissions, or agreements.

`npm run db:verify` signs in as real seeded users and asserts this isolation
holds (a store user cannot read another store's rows; a consignor cannot read
another consignor's rows; staff cannot change prices).

---

## Features by role

**Consignor** — dashboard across all stores (on hand, sold, net owed, overdue,
anomaly feed); create/send deliveries; per-store and per-product reports with CSV
and print/PDF; view statements and confirm remittance received.

**Store** — dashboard across all consignors; confirm incoming deliveries; fast,
mobile-first sale entry; returns entry; generate statements and mark paid;
inventory by consignor; reports with CSV and print/PDF.

**Shared** — email/password auth, role-based routing, anomaly flags, light default
with a dark-mode toggle, keyboard-navigable and WCAG-minded UI.

---

## Design & non-functional notes

- **Light is default**, dark mode via the header toggle.
- Mobile-first; sale entry is usable one-handed.
- Type: system serif headings, system sans body, monospace for figures/IDs.
- Colour: restrained neutral base + a single deep ledger-green accent (oklch);
  status is shown as labelled pills, never colour alone.
- Privacy (RA 10173 posture): only necessary PII (names, contacts); access is
  limited by role at the database layer.
- No payment gateway — settlement tracks status only, no card/e-wallet
  processing.

---

## Project layout

```
src/
  app/                 App Router pages (consignor / store / admin) + API routes
    _actions/          Server actions (auth + ledger mutations via RPCs)
  components/          UI primitives + app components (sale entry, feeds, ...)
  lib/
    business.ts        Pure business rules (mirrors the SQL; unit-tested)
    data.ts            RLS-scoped server queries + report aggregation
    supabase/          Browser / server / middleware Supabase clients
    auth.ts            Session + role resolution
supabase/migrations/   SQL: schema, triggers, RLS, reconciliation, demo reset
scripts/
  seed.ts              Demo data + credentials
  verify-rls.ts        Tenant-isolation checks
```
