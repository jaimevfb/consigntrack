# ConsignTrack v2 — Scan Hub, QR, Information Design

Builds on the single SKU ledger (migrations 0018–0022). Ledger semantics unchanged.

## Phase 0 — Audit
- **Nav/shell:** `src/components/app-shell.tsx` (sidebar + mobile sheet). Per-portal layouts set `nav[]`.
- **Receiving entry:** `/store/deliveries` → `receiving-panel.tsx` (scan box opens the manifest modal; awaiting cards are status-only). Receive via `receive_package` RPC.
- **Dispatch entry:** `/consignor/shipments` → `shipment-builder.tsx` (scan-to-dispatch). Return receiving → `inbound-returns.tsx` (scan).
- **Sales entry:** `/store/sales` → `sales-terminal.tsx` (SKU scan-to-cart + `pos_sale`).
- **Package detail view:** none yet — built in Phase 2.
- **Notifications:** none (only an in-transit count badge on the nav). Deep links added in Phase 2 point at `/scan?code=…`.
- **QR libs:** `qrcode.react` (generation, in use). Added **`html5-qrcode@2.3.8`** for camera decode.
- **Ledger guards present:** wrong-destination ✅, idempotent receive (state-machine guard: re-scan of a non-IN_TRANSIT package is rejected) ✅, oversell ✅, price-deviation flag ✅, settled-period lock ✅.
- **Camera:** `getUserMedia` requires HTTPS or localhost — production (Vercel) is HTTPS; typed-code fallback always available.

## What shipped (updated per phase below)

### Shipped
- **Phase 1 Scan Hub** (`/scan`): live camera (`html5-qrcode`) + typed fallback, routed by prefix — PKG→receive (store) / dispatch (consignor), RET→return receiving, SKU→sale cart (multi-scan). Role-aware; wrong-destination + already-done messages. Persistent **Scan** button in the app header. Manifest modal extracted to `package-manifest-modal.tsx` (shared with receiving).
- **Phase 2 QR without a printer**: `/packages/[id]` detail — on-screen QR (large) + human code, **Download label**, **Copy receive link** (`/scan?code=…` deep link), `<PackageTimeline/>` from the package's events, manifest + event history. Shipment/delivery history rows link here.
- **Phase 3 Information design**: inventory v2 — summary strip, attention sort (disputed→low→in-stock by value→out-of-stock collapsed), row-expand with `<CustodyBar/>` + facts.
- **Phase 4 Visuals**: `<DailyBars/>` replaces the smoothed line (bars, y from 0, 2px zero stubs, sparse-data note) on store dashboard + consignor Insights; `<CustodyBar/>` (hatched transit, counts printed).
- **Phase 5 Catalog v2**: products gain `category` (Weaves/Jewelry/Home/Food/Other), `variant`, `description`, `cost` (private), `photo_url`, `perishable`+`shelf_life_days`, `status` (migration 0023). Form: category/variant/cost/photo/description + **Save & add another**; **similar-name guard**. List shows photo, variant chip, category. Archived hidden.
- **Phase 6 Demo cleanup** (migration 0023): categorized all products, Bracelets variant'd (Beaded/Shell), Food → perishable + shelf life, `123` archived.

### Deferred (noted, independent follow-ups)
- Offline scan queue (IndexedDB) — the state-machine already makes re-scans no-ops; offline queue not built.
- Mobile bottom tab-bar (Scan in center) — header Scan button ships instead.
- Photo **upload** (needs Supabase Storage) — photo is a URL field for now.
- **CSV catalog import** (template + mapping + rejects) — not built.
- Aging strip + running settlement meter visuals; sell-through heat matrix.
- Agreement versioning ("rate at event time").
