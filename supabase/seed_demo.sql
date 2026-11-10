-- ConsignTrack — demo seed (stack equivalent of seed/demo.ts)
-- Re-runnable: does nothing if PKG-8841 already exists. The ledger is
-- append-only, so "re-runnable" means "safe to run again", not "wiped & rebuilt".
--
-- Scenario: consignor "Maria's Weaves" ships PKG-8841 to "Kultura — SM Aura":
--   26 units across 4 SKUs (IP-180 x12, TR-450 x6, MAR-0014 x4, MAR-0015 x4),
--   all received, MAR-0015 has 2 disputed, then a couple of POS sales.
-- Known numbers for later verification (package contribution to on-hand):
--   IP-180 +12 -3 = 9 · TR-450 +6 -2 = 4 · MAR-0014 +4 · MAR-0015 +4 -2(hold) = 2

do $$
declare
  v_consignor uuid;
  v_store uuid;
  v_pkg uuid;
  v_ip uuid; v_tr uuid; v_m14 uuid; v_m15 uuid;
begin
  if exists (select 1 from public.packages where pkg_code = 'PKG-8841') then
    raise notice 'seed skipped: PKG-8841 already exists';
    return;
  end if;

  select id into v_consignor from public.consignors where name = 'Maria''s Weaves' limit 1;
  select id into v_store from public.stores where name = 'Kultura — SM Aura' limit 1;
  select id into v_ip  from public.products where sku = 'IP-180'  and consignor_id = v_consignor;
  select id into v_tr  from public.products where sku = 'TR-450'  and consignor_id = v_consignor;
  select id into v_m14 from public.products where sku = 'MAR-0014' and consignor_id = v_consignor;
  select id into v_m15 from public.products where sku = 'MAR-0015' and consignor_id = v_consignor;

  if v_consignor is null or v_store is null or v_ip is null or v_tr is null or v_m14 is null or v_m15 is null then
    raise notice 'seed skipped: expected consignor/store/SKUs not found';
    return;
  end if;

  insert into public.packages (pkg_code, direction, consignor_id, consignee_id, status, in_transit_at)
  values ('PKG-8841', 'OUTBOUND', v_consignor, v_store, 'DELIVERED', now() - interval '3 days')
  returning id into v_pkg;

  insert into public.package_lines (package_id, sku_id, qty_expected, qty_received, qty_disputed) values
    (v_pkg, v_ip,  12, 12, 0),
    (v_pkg, v_tr,   6,  6, 0),
    (v_pkg, v_m14,  4,  4, 0),
    (v_pkg, v_m15,  4,  4, 2);

  -- RECEIVE (one per line) + DISPUTE_HOLD for the 2 contested MAR-0015 units.
  insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, ref_id, reason) values
    (v_store, v_ip,  'RECEIVE',       12, 'package', v_pkg, null),
    (v_store, v_tr,  'RECEIVE',        6, 'package', v_pkg, null),
    (v_store, v_m14, 'RECEIVE',        4, 'package', v_pkg, null),
    (v_store, v_m15, 'RECEIVE',        4, 'package', v_pkg, null),
    (v_store, v_m15, 'DISPUTE_HOLD',  -2, 'package', v_pkg, 'short/contested at receiving');

  -- A couple of POS sales off the package.
  insert into public.ledger_entries (consignee_id, sku_id, entry_type, qty, ref_type, reason) values
    (v_store, v_ip, 'SALE', -3, 'sale', 'demo POS scan'),
    (v_store, v_tr, 'SALE', -2, 'sale', 'demo POS scan');

  raise notice 'seeded PKG-8841 for Kultura (Maria''s Weaves)';
end $$;
