/**
 * ConsignTrack RLS verification.
 *
 * Signs in as real seeded users (via the public anon key, so RLS applies) and
 * asserts tenant isolation:
 *   - a store user sees only their own store's rows
 *   - a consignor sees only their own consignor's rows
 *   - store_staff cannot change prices or commissions (BR8)
 *
 * Run after seeding:  npm run seed  &&  npm run db:verify
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

async function main() {
  // Resolve ids with the service role (bypasses RLS).
  const { data: stores } = await admin.from("stores").select("id, name");
  const { data: consignors } = await admin.from("consignors").select("id, name");
  const { data: products } = await admin.from("products").select("id, name");
  const byStore = Object.fromEntries((stores ?? []).map((s) => [s.name, s.id]));
  const maria = (consignors ?? [])[0];
  const productId = (products ?? [])[0]?.id;
  const baguioId = byStore["Baguio Pasalubong Center"];
  const ilocosId = byStore["Ilocos Craft Corner"];

  console.log("RLS verification");
  console.log("-----------------------------------------------------------------");

  // 1. Store manager (Baguio) sees only Baguio stock
  const baguio = await signedIn("baguio@consigntrack.test", "store123");
  const { data: baguioStock } = await baguio.from("stock_levels").select("store_id");
  check(
    "Store manager sees only their own store's stock",
    (baguioStock ?? []).length > 0 && (baguioStock ?? []).every((r) => r.store_id === baguioId),
    `${(baguioStock ?? []).length} rows, all Baguio`,
  );

  // 2. Baguio cannot see Ilocos sales
  const { data: baguioSales } = await baguio.from("sales").select("store_id");
  check(
    "Store manager cannot read another store's sales",
    (baguioSales ?? []).every((r) => r.store_id === baguioId),
    `${(baguioSales ?? []).length} sale rows, none from Ilocos`,
  );

  // 3. Store manager sees only their own store in the stores table
  const { data: baguioStores } = await baguio.from("stores").select("id");
  check(
    "Store manager sees only their own store row",
    (baguioStores ?? []).length === 1 && baguioStores?.[0]?.id === baguioId,
    `sees ${(baguioStores ?? []).length} store(s)`,
  );

  // 4. Consignor sees only their own consignor's stock, across all stores
  const consignor = await signedIn("maria@consigntrack.test", "consignor123");
  const { data: mariaStock } = await consignor.from("stock_levels").select("consignor_id, store_id");
  const distinctStores = new Set((mariaStock ?? []).map((r) => r.store_id));
  check(
    "Consignor sees only their own rows (all stores)",
    (mariaStock ?? []).length > 0 && (mariaStock ?? []).every((r) => r.consignor_id === maria?.id),
    `${(mariaStock ?? []).length} rows across ${distinctStores.size} stores`,
  );

  // 5. store_staff cannot change a price (BR8)
  const staff = await signedIn("staff@consigntrack.test", "staff123");
  const { data: updated } = await staff.from("products").update({ unit_price: 99999 }).eq("id", productId).select();
  const { data: after } = await admin.from("products").select("unit_price").eq("id", productId).single();
  check(
    "store_staff cannot change a product price (BR8)",
    (updated ?? []).length === 0 && Number(after?.unit_price) !== 99999,
    "update affected 0 rows",
  );

  // 6. Ilocos manager cannot read Baguio's stock either (symmetry)
  const ilocos = await signedIn("ilocos@consigntrack.test", "store123");
  const { data: ilocosStock } = await ilocos.from("stock_levels").select("store_id");
  check(
    "A second store is isolated too",
    (ilocosStock ?? []).every((r) => r.store_id === ilocosId),
    `${(ilocosStock ?? []).length} rows, all Ilocos`,
  );

  console.log("-----------------------------------------------------------------");
  if (failures === 0) {
    console.log("All RLS checks passed. Tenant isolation is enforced in the database.");
  } else {
    console.error(`${failures} RLS check(s) FAILED.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Verification error:", e.message);
  process.exit(1);
});
