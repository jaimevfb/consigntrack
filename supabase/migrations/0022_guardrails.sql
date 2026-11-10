-- Accuracy guardrails (concept §5): price-deviation flag + settled-period lock.
-- See applied definitions for pos_sale and generate_settlement_ledger.
alter table public.ledger_entries add column if not exists price_flag boolean not null default false;
-- pos_sale: SALE whose price != agreed price sets price_flag (flagged, not rejected).
-- generate_settlement_ledger: rejects a period overlapping a confirmed statement.
