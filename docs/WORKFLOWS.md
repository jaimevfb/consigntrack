# ConsignTrack — How it works, case by case

This explains how data flows end-to-end, from logistics to settlement, and how the
**serialized item lifecycle** and the **aggregate ledger** (inventory, sales,
settlement) now stay in sync. Everything below is enforced in the database
(Postgres + RLS + triggers), not just the UI.

## Two inventory models, one ledger
- **Serialized items** — one row per physical unit, each with a signed QR and a
  chain-of-custody (`items`, `scan_events`). Good for 1-of-1 / high-value goods.
- **Bulk quantity** — classic deliveries/stock counts (`deliveries`,
  `delivery_items`, `stock_levels`) for items sold by quantity.

Both post to the **same append-only `stock_movements` ledger**, so inventory,
reconciliation, analytics and settlement see everything. Invariant, always true:
`stock_levels.qty_on_hand == Σ stock_movements` for each (store, product,
consignor).

Each serialized item is backed by a **catalogue product** (auto-created when you
make an item, or pick an existing one), so one item = one unit of that product.

---

## Case A — The standard pipeline (product → delivery → … → settlement)
This is the single, foolproof operational flow. Logistics status is driven **only**
by QR scans — there is no manual "confirm" button.
1. **Make a product** (Consignor → *Products*). Your catalogue item + price.
2. **Create a delivery** (Consignor → *Deliveries → New*). Pick the store and add
   product lines with quantities. The system **mints one QR-labelled tracked item
   per unit** (`create_delivery_items`) and opens the delivery as `draft`. Print the
   labels from each item.
3. **Dispatch by scanning** (Consignor → *Scan*, action **Dispatch**). Scan each
   unit's QR → item `dispatched`; once any unit is dispatched the delivery flips to
   `sent`. **This is the only way to dispatch** — no scan, no hand-off.
4. **Receive by scanning** (Consignee → *Scan*, action **Receive**). Scan each QR →
   **dual-scan enforced** (rejected unless a matching consignor dispatch exists) →
   item `received_confirmed` and a `+1 delivery` movement posts, so the unit appears
   in **Inventory**. When every unit is received, the delivery auto-flips to
   `confirmed`. The store page shows live `received / total` progress.
5. **List & sell** (Consignee → *Scan* `list` then `sell`, or the item page). Selling
   writes a `sale` + `sale_item` + `-1` movement → **Sales, Analytics and
   Settlement** update; Inventory drops.
6. **Settle** (Case F).

At every step the **custody timeline** (append-only scans) is the proof and the
lifecycle stepper shows where each unit is.

*Single-item variant:* a consignor can also create one ad-hoc tracked item
(Consignor → *Tracked items → New*) without a delivery; it follows the same scan
lifecycle from step 3.

## Case B — Bulk quantity (legacy / non-serialized)
For goods tracked only by count (no per-unit QR), the older path still exists:
consignor delivery with quantities → consignee **confirms** (`confirm_delivery`) →
`+qty` stock → sales via the fast Sell screen or **CSV/POS import**. New deliveries
use the serialized pipeline in Case A; this remains for high-volume, non-serialized
stock.

## Case C — Returns
- **Serialized:** Consignee scans `return` → status `returned_to_consignor`,
  `-1 return` movement (stock drops). Does **not** reverse recorded sales (BR6).
- **Bulk:** Returns screen → `return` row + `-qty return` movement.

## Case D — Exceptions (the Owner queue)
A physical-handoff status can only be set by a valid scan, never a dropdown. Any
mismatch is **recorded** (append-only) and **raised to the Admin → Exceptions**
queue, without advancing state:
- **missing_scan** — receive attempted with no dispatch on record (dual-scan).
- **out_of_order** — e.g. sell before list, or dispatch after sold.
- **wrong_actor** — e.g. a consignor tries to "receive".
- **tamper** — unknown or forged QR (signature check fails) → rejected outright.

## Case E — Lost / damaged
Any custody holder can flag `lost`/`damaged`. The item moves to that state, a
`-1 adjustment` movement removes it from stock (if it had been received), and an
exception is raised for the owner.

## Case F — Settlement (money)
For a consignor–store pair over a period:
- `gross = Σ (units sold × price)` (serialized sales + bulk sales both count)
- `commission = gross × agreement.commission_pct`
- `returns_total = Σ returns value`
- **`net_payable = gross − commission − returns_total`**

Flow (BR7): Store **generates** the statement → **marks paid** (`paid_at`) →
Consignor **confirms received** (`confirmed_at`). A settlement is only `confirmed`
when **both** timestamps exist. Statements export to CSV; the reconciliation view
proves sold = settled + outstanding.

## Case G — Onboarding a new account (the "sync")
1. **Sign up** as Consignor or Store (email-free provisioning for the demo).
2. A brand-new account has no partners, so it starts isolated. Go to **Partners**
   (Consignor → *Partners*, Store manager → *Partners*): browse the directory and
   **Connect** — this creates the active **agreement** (commission + cadence) that
   links the two sides.
3. Now the account is wired in: the consignor can add products/items and dispatch
   to that store; the store sees inbound items and can receive/sell; settlements
   compute against the agreement. (Admins can also create/edit any agreement under
   **Admin → Agreements**; commission edits are audited.)

## Roles at a glance
| Capability | Admin | Consignor | Store manager | Store staff |
|---|---|---|---|---|
| See everything | ✓ | own rows | own store | own store |
| Set commission / agreements | ✓ | — | own store | — |
| Create items / products / deliveries | ✓ | ✓ | — | — |
| Dispatch | ✓ | ✓ (own) | — | — |
| Receive / list / sell / return | ✓ | — | ✓ | ✓ |
| Generate / mark-paid settlements | ✓ | — | ✓ | — |
| Confirm payment received | ✓ | ✓ | — | — |
| Resolve exceptions / disputes | ✓ | — | — | — |

## Integrity guarantees
- `stock_movements`, `scan_events`, and `audit_log` are **append-only**.
- Stock can never go negative (BR1); reconciliation returns **zero mismatches**.
- Every state and money change is attributable (actor + timestamp).
