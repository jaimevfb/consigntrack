# ConsignTrack — Consignee Portal Refactor Notes

Phase 0 audit (read-only). Status: **paused for a scope decision** — see "Conflicts" at the end.

## 1. Stack

- **Framework:** Next.js 14 (App Router, React Server Components + Server Actions), TypeScript.
- **Backend/DB:** Supabase (PostgreSQL 17). Data access is server-side via `@supabase/ssr`; business rules live in PL/pgSQL RPCs + triggers. RLS on every table.
- **State:** server components fetch directly; mutations are server actions in `src/app/_actions/*` calling RPCs. No client store.
- **Routing:** App Router folders under `src/app/{admin,consignor,store}`. Three portals share one schema and one component library (`src/components`).
- **Styling:** Tailwind + CSS-variable tokens (`globals.css`), shadcn-style primitives.

## 2. Where the numbers come from — why 27 ≠ 2

There are **two parallel stock systems** in the DB today:

| System | Tables | Unit |
|---|---|---|
| **Quantity ledger** | `stock_movements` (append-only) → `stock_levels` (stored derived `qty_on_hand`) | per SKU/store/consignor |
| **Unit serialization** | `items` (one row per physical unit, `CT-XXXXXX` code + `qr_token`) + `scan_events` | per unit |

- **"Items on hand" = 27** → `getStoreDashboard()` (`src/lib/data.ts:171`) sums `stock_levels.qty_on_hand` for the store.
- **"In Custody" = 2** → `CustodySummary` ← `getItemStatusCounts()` (`src/lib/items-data.ts:84`) counts `items` by `status` (`received_confirmed` + `listed`). It calls `getItems()` which is **not store-scoped**, so it also counts across stores — a second bug.

They disagree because they read different tables that are only loosely kept in sync (migration `0011_item_ledger_sync` wires some of it). This is exactly the single-source-of-truth problem the refactor targets.

Screen-by-screen stock sources:
- Dashboard "Items on hand" → `stock_levels`. Custody widget → `items` status counts.
- Inventory (`/store/inventory`) → `stock_levels`.
- Sales oversell guard (`record_sale` RPC, BR1) → `stock_levels`.
- Deliveries (`/store/deliveries`) → `deliveries` + mints `items`.
- Returns (`/store/returns`) → `returns` table + `stock_movements`.
- Item records / Scan (`/store/items`, `/store/scan`) → `items` + `scan_events`.

## 3. Serialization / chain-of-custody inventory (what Phase 2 would delete)

Code: `src/app/_actions/items.ts`, `src/lib/items-data.ts`, `src/components/item-detail-view.tsx`, `item-lifecycle.tsx` (LifecycleStepper, CustodyTimeline), `custody-summary.tsx`, `scan-panel.tsx`, `src/app/store/items`, `src/app/store/scan`, `src/app/consignor/items`, `src/app/consignor/scan`, `src/app/admin/items`, `admin/exceptions`.
DB: `items`, `scan_events`, `disputes`, `exceptions`; migrations `0009`,`0010`,`0011`,`0013` (delivery→items pipeline), parts of `0015`,`0016`.
`CT-` codes + custody are read by **both** the store and the consignor portals.

## 4. Current tabs (12 store → target 6)

Dashboard · Analytics · Catalog · Scan items · Item records · Sales · Deliveries · Inventory · Returns · Business partners · Settlements · Reports.
Target: Dashboard(+Analytics) · Deliveries & Receiving · Sales · Inventory & Catalog · Returns · Partners & Settlements.

## 5. What already matches the target model (reuse, don't rebuild)

- `agreements` (+ `commission_overrides`) already hold commission %, cadence, period, liability — matches the spec's `agreements`. Commission is already read from here, not from products. ✅
- `products` already SKU-keyed, no quantity fields, consignor-owned, read-only to stores via RLS. ✅ (unit_of_measure exists.)
- `deliveries` + `delivery_items` already ARE a package/line model (consignor→store, qty per SKU) — minus PKG- codes, direction, and the receiving state machine.
- `stock_movements` is already an append-only ledger — close to the spec's `ledger_entries` but with a different `movement_type` vocabulary and a **stored** `stock_levels` sibling.
- Primary color is already `#2563EB`-family blue; aesthetic constraint is satisfied.

## Conflicts with the prompt (Phase 0 stop point)

**A — BLOCKER: the model is shared by both portals; the consignee side can't be refactored in isolation.**
The prompt scopes this to the Consignee Portal and puts the consignor portal out of scope ("just don't break its reads"). But `items`/`scan_events` and the item-minting delivery flow are the **consignor portal's core** (its Item records, Scan, item detail, custody, and the Deliveries screen that *creates* the packages all run on `items`). Phase 2 ("delete all serialization, grep returns zero `CT-`") **will break the consignor portal's reads and its create-delivery workflow**, which Phase-0 scope forbids. These two instructions are mutually exclusive as written.

**B — `ledger_entries` vs existing `stock_movements` + stored `stock_levels`.** The spec wants on-hand computed purely as Σ ledger (a view/function) and "delete every other stock computation," but a stored `stock_levels` table exists and is read by Sales/Inventory/Dashboard. Adaptable (repurpose `stock_movements`, drop stored `stock_levels` for a view), but it's a design choice to confirm.

**C — `packages` vs `deliveries`.** `deliveries`/`delivery_items` should become `packages`/`package_lines` (add `pkg_code`, `direction`, receiving states, `qty_received`/`qty_disputed`). This again edits the flow the consignor uses to build a delivery → ties back to A.

**D — Returns.** Existing `returns` table + manual form would be replaced by `RET-` packages + `RETURN_OUT` ledger entries; existing returns need migrating.

### Recommended options to unblock A
1. **Expand scope to the shared ledger (recommended).** Migrate *both* portals onto the package/ledger model in this refactor — it is physically one system, and the "unit vs quantity" seam is the actual root bug. The consignor's deliveries become outbound packages; its Item-records/Scan/custody screens are replaced by package + ledger views. Larger, but it's the only way to truly delete serialization and reach one source of truth.
2. **Dual-model with a compatibility layer.** Build `packages`/`ledger_entries` for the consignee side only; keep `items`/`scan_events` alive for the consignor portal behind an adapter so its reads don't break. Honors the stated scope, but leaves two models running (doesn't kill the root bug) and is more total code.

---

## Decision: Option 1 (expand to the shared ledger). Progress log.

### Phase 1 — Unified data layer ✅ (migration `0018_two_tier_ledger.sql`, `supabase/seed_demo.sql`)
- New tables: `packages` (PKG-/RET-, direction, consignee-locked), `package_lines` (qty_expected/received/disputed), `ledger_entries` (append-only, 6 entry types, signed qty, ref_type/ref_id, actor, reason).
- Append-only enforced by `block_ledger_mutation()` triggers (UPDATE/DELETE both blocked — verified).
- **The one formula:** view `v_on_hand` + function `get_on_hand(consignee, sku)` = Σ ledger qty. Nothing else computes stock from Phase 4 on.
- Evolved: `products.status`, `agreements.effective_from`, `sale_items.source`, `settlements.payment_proof_url`.
- RLS: reads scoped to store/consignor/admin; writes only via SECURITY DEFINER RPCs (direct writes blocked by RLS).
- **Opening balances — DEVIATION:** seeded from `stock_levels` (the real quantity source), not the sparse `items` table which never held true quantities. One `ADJUSTMENT` entry per SKU/store, reason `"migration from unit serialization"`, re-runnable (guarded). Reproduces reality: Kultura 27, Baguio 16, Ilocos 11.
- Junk product `"123"` archived (status='archived'); a hard delete is blocked by the legacy `stock_movements` append-only guard and legacy FKs — it carries 0 stock so it never enters the ledger, and Phase 2 removes it fully when legacy tables drop.
- Seed `PKG-8841` (Maria's Weaves → Kultura, 26 units / 4 SKUs, 2 disputed, 2 sales) verified: IP-180 31, TR-450 8, MAR-0014 5, MAR-0015 2.
- No app code changed in Phase 1 (additive), so the build is unchanged/green.

### Phase 2 — Delete serialization (consignee side) ✅ / app-wide ⏳
- All consignee serialization routes removed: `/store/items`, `/store/scan`, `/store/catalog`, `/store/analytics`, `/store/partners`, `/store/reports`, `/store/sales/import` now redirect to their new homes. The store experience references no `CT-` codes or chain-of-custody.
- **Not yet dropped:** the legacy tables (`items`, `scan_events`, `stock_levels`, `stock_movements`, `delivery_items`, `deliveries`, `returns`, `disputes`, `exceptions`) and the serialization components (`item-detail-view`, `item-lifecycle`, `custody-summary`, `scan-panel`) remain because the **consignor and admin portals still read them**. Dropping them requires migrating those two portals to the ledger — see Follow-ups.

### Phase 3 — Navigation 12 → 6 ✅
Final store tab map: **Dashboard · Deliveries & Receiving · Sales · Inventory & Catalog · Returns · Partners & Settlements** (staff see the first four). Old URLs redirect.

### Phase 4 — Screens ✅ (migration `0019_ledger_rpcs.sql`, `src/lib/ledger-data.ts`, `src/app/_actions/ledger-ops.ts`)
- Dashboard: 4 ledger KPIs (active stock units+₱, incoming packages, period gross+commission, settlements due); daily sales + top SKUs; CTAs Scan Package QR / Record Sale. Custody widget deleted — `27 ≠ 2` gone (one source).
- Deliveries & Receiving: awaiting list, package manifest modal (Confirm All / Report Discrepancy + photo), wrong-destination guard, history.
- Sales: SKU search + scan-to-cart, on-hand guards (client + server `pos_sale`).
- Inventory & Catalog (merged): grouped by consignor; Product, SKU, price, commission, on-hand, in-dispute, value, status; read-only on catalog.
- Returns: Return Package Builder → `RET-` package + QR label; writes RETURN_OUT; no manual return.
- Partners & Settlements (merged): agreements (read-only terms) + settlements computed strictly from SALE ledger entries + pay/confirm + payment receipt.
- RPCs with state machines: `create_outbound_package`/`dispatch_package`, `receive_package`, `pos_sale`, `build_return_package`, `resolve_dispute`, `adjust_stock`, `generate_settlement_ledger`.

### Phase 5 — Shared controls ✅ (data layer)
- Audit trail: every ledger write carries `actor_user_id` + `created_at`; per-package event history exposed via `getPackageDetail().events`.
- Discrepancy freeze: `DISPUTE_HOLD` reduces on-hand and is excluded from billable stock and settlement — inherent in the formula.
- Locked terms: commission % and period are read from `agreements` on every screen; no consignee UI edits them.

### Phase 6 — Verify ✅
- `tsc` + `next build` pass.
- Seed scenario E2E on the ledger (rolled back): create→dispatch→**receive 24 / dispute 2 → sell 10 → return 5 ⇒ on_hand = 7**, test-SKU gross = 1000, settlement generated. Asserts `on_hand = received − sold − returned − disputed`.
- Negative guards: oversell **rejected**, wrong-destination receive **rejected**.
- Receiving/sales/returns components are mobile-first (bottom-sheet modal, stacking layouts) for 375px dock use.

## Follow-ups (remaining to fully close Option 1)
1. **Migrate the consignor + admin portals to the ledger** (dashboards, inventory, deliveries→outbound packages, analytics, reconciliation, reports), then delete the serialization components and **drop the legacy tables**. This is the second half of Option 1; the consignee portal is the reference implementation to mirror.
2. CSV/POS bulk import on Sales — currently redirects; rewire to `pos_sale` with the "rows that would go negative are rejected with the math shown" rule.
3. Package detail page with the event-history timeline (data already available).
