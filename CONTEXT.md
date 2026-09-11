# ConsignTrack — project context

**What it is.** A shared consignment ledger for Philippine MSME retail: one
producer (consignor) places goods in stores (consignees); both sides read the
same numbers. Records/settlement system — **not** a POS or payment processor.

**Non-negotiable invariant.** `opening + confirmed deliveries − sales − returns =
current stock on hand`, for every `(store, product, consignor)`. Every stock
change is a `stock_movements` row (append-only). `stock_levels` is derived and
kept in sync by the `apply_stock_movement` trigger.

**Where correctness lives.** In Postgres, not the UI:
- `stock_movements` insert trigger enforces BR1 (no negative stock).
- Transactional RPCs (`confirm_delivery`, `record_sale`, `record_return`,
  `generate_settlement`, `mark_settlement_paid`, `confirm_payment_received`,
  `adjust_stock`) are the only sanctioned write paths for ledger events.
- RLS policies scope every table by role (admin / consignor / store_manager /
  store_staff). Helper predicates: `is_admin()`, `current_consignor_id()`,
  `current_store_id()`, `is_store_manager_or_admin()`.
- `src/lib/business.ts` is a faithful pure-TS copy of the maths for reuse + tests;
  the DB remains the source of truth.

**Conventions.**
- Corrections are new `adjustment` movements — never edits/deletes of history.
- Keep PII minimal (names, contacts only). Commit no secrets (`.env.example` only).
- Prefer a correct, reconciling ledger over more features.
- Light theme is the default; status is always a labelled pill, never colour alone.

**Verifying a change.** `npm run typecheck && npm test && npm run build`; against a
live DB, `npm run seed && npm run db:verify` (RLS isolation) and check that
`reconcile_stock()` returns zero rows.
