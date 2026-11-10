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
