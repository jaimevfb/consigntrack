# ConsignTrack — Setup

## Run locally
```bash
npm install
# Local Supabase (needs Docker + Supabase CLI):
supabase start
supabase db reset          # applies all migrations in supabase/migrations (0001–0010)
cp .env.example .env.local && cp .env.example .env   # paste keys from `supabase start`
npm run seed               # base demo data (consignor, stores, agreements, sales, settlement)
npm run dev                # http://localhost:3000
```

> The serialized **Items / QR chain-of-custody** demo data (migration-era) is seeded on
> the hosted project via SQL. For a local run, create items from the Consignor →
> **Tracked items** screen (each issues a signed QR), then walk them through the
> lifecycle with the **Scan** screen.

## Live demo
Deployed: **https://consigntrack-zeta.vercel.app** (Supabase `ap-southeast-1`, Vercel).

## Test logins (all three lenses)
| Role | Email | Password |
| --- | --- | --- |
| Owner/Admin | `admin@consigntrack.test` | `admin123` |
| Consignor | `maria@consigntrack.test` | `consignor123` |
| Consignee (Store manager) | `kultura@consigntrack.test` | `store123` |
| Consignee — Baguio | `baguio@consigntrack.test` | `store123` |
| Consignee — Ilocos | `ilocos@consigntrack.test` | `store123` |
| Store staff (restricted) | `staff@consigntrack.test` | `staff123` |

New consignor/store accounts can also self-register from the **Sign up** tab.

## Try the chain of custody
1. **Consignor** (maria) → *Tracked items* → open **CT-CA4EC6** to see a full
   custody timeline + signed QR, or create a new item (issues a QR label).
2. Create/inspect a `labeled` item → **Mark dispatched**.
3. **Consignee** (the destination store) → *Scan* → action **Receive** → enter the
   item code (or scan the QR). Receiving is refused unless a valid dispatch scan
   exists (dual-scan). Then **List** → **Sell**.
4. **Admin** → *Exceptions* → resolve custody anomalies and disputes.

## Assumptions made
- **Roles map:** the paper's *Consignee* = a **Store** (`store_manager`/`store_staff`).
- **Serialized Items coexist** with the aggregate quantity ledger: the QR/custody
  layer tracks individual units for trust; the existing ledger still drives
  settlement + analytics. Per-item settlement is Phase 2.
- **Logistics cost** is borne by the consignee by default (common PH practice).
- **Signup** provisions accounts directly (email-free) because the hosted project has
  email confirmation on + free-tier email rate limits; flip Supabase "Confirm email"
  on to use the standard flow.
- **QR tokens** are HMAC-signed (secret in `private_config`, never exposed); scanning
  verifies the signature and rejects unknown/tampered codes.

## Phase status
- **Phase 1 (done):** serialized Items, signed-QR chain-of-custody, server-enforced
  lifecycle state machine, dual-scan handoff, append-only ScanEvents + AuditLog,
  exceptions queue, disputes, printable labels, mobile scan flow.
- **Phase 2 (planned):** per-item settlement + reconciliation, first-class
  Shipments/legs logistics board, PDF export of the new reports, deeper dashboards.
