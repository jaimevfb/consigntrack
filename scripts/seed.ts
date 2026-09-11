/**
 * ConsignTrack seed — demo data that matches the research scenario.
 *
 * Creates auth users + app_users, one consignor across three stores, confirmed
 * deliveries, recorded sales, ONE overdue settlement, and ONE seeded
 * discrepancy (stock dropped with no matching sale) so the anomaly flag shows
 * on first load. Prints the demo credentials at the end.
 *
 * Run against a fresh schema:  npm run db:reset  &&  npm run seed
 * Re-runnable: it calls reset_demo() and recreates the demo auth users.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in.",
  );
  process.exit(1);
}

const db: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- demo credentials -------------------------------------------------------
const CREDS = {
  admin: { email: "admin@consigntrack.test", password: "admin123", name: "System Admin" },
  consignor: { email: "maria@consigntrack.test", password: "consignor123", name: "Maria Santos" },
  kultura: { email: "kultura@consigntrack.test", password: "store123", name: "Liza Reyes" },
  baguio: { email: "baguio@consigntrack.test", password: "store123", name: "Ben Dela Cruz" },
  ilocos: { email: "ilocos@consigntrack.test", password: "store123", name: "Grace Tan" },
  staff: { email: "staff@consigntrack.test", password: "staff123", name: "Kultura Staff" },
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function createUser(email: string, password: string) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

async function deleteDemoUsers() {
  const emails = new Set(Object.values(CREDS).map((c) => c.email));
  // page through existing users and remove any matching demo emails
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email && emails.has(u.email)) {
        await db.auth.admin.deleteUser(u.id);
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
}

async function insert<T = { id: string }>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.from(table).insert(row).select().single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data as T;
}

async function main() {
  console.log("Resetting demo data…");
  const { error: resetErr } = await db.rpc("reset_demo");
  if (resetErr) throw new Error(`reset_demo: ${resetErr.message}`);
  await deleteDemoUsers();

  console.log("Creating auth users…");
  const adminUid = await createUser(CREDS.admin.email, CREDS.admin.password);
  const mariaUid = await createUser(CREDS.consignor.email, CREDS.consignor.password);
  const kulturaUid = await createUser(CREDS.kultura.email, CREDS.kultura.password);
  const baguioUid = await createUser(CREDS.baguio.email, CREDS.baguio.password);
  const ilocosUid = await createUser(CREDS.ilocos.email, CREDS.ilocos.password);
  const staffUid = await createUser(CREDS.staff.email, CREDS.staff.password);

  console.log("Inserting consignor, stores, products…");
  const maria = await insert("consignors", {
    name: "Maria's Weaves",
    contact: "maria@consigntrack.test",
    type: "artisan",
  });

  const kultura = await insert("stores", {
    name: "Kultura — SM Aura",
    location: "Taguig, Metro Manila",
    manager: CREDS.kultura.name,
    contact: CREDS.kultura.email,
  });
  const baguio = await insert("stores", {
    name: "Baguio Pasalubong Center",
    location: "Baguio City",
    manager: CREDS.baguio.name,
    contact: CREDS.baguio.email,
  });
  const ilocos = await insert("stores", {
    name: "Ilocos Craft Corner",
    location: "Vigan, Ilocos Sur",
    manager: CREDS.ilocos.name,
    contact: CREDS.ilocos.email,
  });

  const runner = await insert("products", {
    consignor_id: maria.id,
    name: "Handwoven table runner",
    sku: "TR-450",
    unit_price: 450,
  });
  const pouch = await insert("products", {
    consignor_id: maria.id,
    name: "Inabel pouch (small)",
    sku: "IP-180",
    unit_price: 180,
  });

  console.log("Linking app_users…");
  await db.from("app_users").insert([
    { auth_user_id: adminUid, role: "admin", full_name: CREDS.admin.name },
    { auth_user_id: mariaUid, role: "consignor", consignor_id: maria.id, full_name: CREDS.consignor.name },
    { auth_user_id: kulturaUid, role: "store_manager", store_id: kultura.id, full_name: CREDS.kultura.name },
    { auth_user_id: baguioUid, role: "store_manager", store_id: baguio.id, full_name: CREDS.baguio.name },
    { auth_user_id: ilocosUid, role: "store_manager", store_id: ilocos.id, full_name: CREDS.ilocos.name },
    { auth_user_id: staffUid, role: "store_staff", store_id: kultura.id, full_name: CREDS.staff.name },
  ]);

  console.log("Creating agreements (15%, monthly)…");
  const agKultura = await insert("agreements", {
    consignor_id: maria.id, store_id: kultura.id, commission_pct: 15, settlement_cadence: "monthly", is_active: true,
  });
  const agBaguio = await insert("agreements", {
    consignor_id: maria.id, store_id: baguio.id, commission_pct: 15, settlement_cadence: "monthly", is_active: true,
  });
  const agIlocos = await insert("agreements", {
    consignor_id: maria.id, store_id: ilocos.id, commission_pct: 15, settlement_cadence: "monthly", is_active: true,
  });

  // Helper: a confirmed delivery + items + stock movements
  async function confirmedDelivery(
    storeId: string,
    agreementId: string,
    dateISO: string,
    lines: { productId: string; qty: number; price: number }[],
  ) {
    const delivery = await insert("deliveries", {
      consignor_id: maria.id,
      store_id: storeId,
      agreement_id: agreementId,
      delivery_date: dateISO,
      status: "confirmed",
      confirmed_at: new Date(dateISO).toISOString(),
    });
    for (const l of lines) {
      await db.from("delivery_items").insert({
        delivery_id: delivery.id, product_id: l.productId, qty: l.qty, unit_price: l.price,
      });
      await db.from("stock_movements").insert({
        entity_type: "delivery", entity_id: delivery.id, movement_type: "delivery",
        qty_delta: l.qty, store_id: storeId, product_id: l.productId,
        consignor_id: maria.id,
      });
    }
    return delivery;
  }

  // Helper: a sale + items + stock movements (dated)
  async function sale(
    storeId: string,
    soldAt: Date,
    lines: { productId: string; qty: number; price: number }[],
  ) {
    const s = await insert("sales", { store_id: storeId, sold_at: soldAt.toISOString() });
    for (const l of lines) {
      await db.from("sale_items").insert({
        sale_id: s.id, product_id: l.productId, consignor_id: maria.id, qty: l.qty, unit_price: l.price,
      });
      await db.from("stock_movements").insert({
        entity_type: "sale", entity_id: s.id, movement_type: "sale",
        qty_delta: -l.qty, store_id: storeId, product_id: l.productId, consignor_id: maria.id,
      });
    }
    return s;
  }

  console.log("Seeding deliveries and sales…");
  // Store A — Kultura (healthy, current month)
  await confirmedDelivery(kultura.id, agKultura.id, isoDate(daysAgo(20)), [
    { productId: runner.id, qty: 15, price: 450 },
    { productId: pouch.id, qty: 40, price: 180 },
  ]);
  await sale(kultura.id, daysAgo(2), [
    { productId: runner.id, qty: 4, price: 450 },
    { productId: pouch.id, qty: 8, price: 180 },
  ]);
  await sale(kultura.id, daysAgo(1), [
    { productId: runner.id, qty: 2, price: 450 },
    { productId: pouch.id, qty: 4, price: 180 },
  ]);

  // Store B — Baguio (overdue: last-month activity + a pending statement)
  const lastMonthEndDate = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  const lastMonthStartDate = new Date(lastMonthEndDate.getFullYear(), lastMonthEndDate.getMonth(), 1);
  await confirmedDelivery(baguio.id, agBaguio.id, isoDate(new Date(lastMonthStartDate.getFullYear(), lastMonthStartDate.getMonth(), 3)), [
    { productId: runner.id, qty: 12, price: 450 },
    { productId: pouch.id, qty: 30, price: 180 },
  ]);
  await sale(baguio.id, new Date(lastMonthStartDate.getFullYear(), lastMonthStartDate.getMonth(), 15), [
    { productId: runner.id, qty: 8, price: 450 },
    { productId: pouch.id, qty: 20, price: 180 },
  ]);

  // Store C — Ilocos (current month + a seeded discrepancy)
  await confirmedDelivery(ilocos.id, agIlocos.id, isoDate(daysAgo(18)), [
    { productId: runner.id, qty: 10, price: 450 },
    { productId: pouch.id, qty: 25, price: 180 },
  ]);
  await sale(ilocos.id, daysAgo(3), [
    { productId: runner.id, qty: 3, price: 450 },
    { productId: pouch.id, qty: 5, price: 180 },
  ]);

  console.log("Generating the overdue settlement for Baguio (last month)…");
  const { error: genErr } = await db.rpc("generate_settlement", {
    p_agreement_id: agBaguio.id,
    p_period_start: isoDate(lastMonthStartDate),
    p_period_end: isoDate(lastMonthEndDate),
  });
  if (genErr) throw new Error(`generate_settlement: ${genErr.message}`);
  // leave it 'pending' -> overdue because period_end is in the past

  console.log("Seeding ONE discrepancy (unexplained shrinkage at Ilocos)…");
  const { error: adjErr } = await db.from("stock_movements").insert({
    entity_type: "adjustment",
    movement_type: "adjustment",
    qty_delta: -2,
    store_id: ilocos.id,
    product_id: pouch.id,
    consignor_id: maria.id,
    note: "Seeded discrepancy: 2 pouches missing with no matching sale or return",
  });
  if (adjErr) throw new Error(`seed discrepancy: ${adjErr.message}`);

  // --- verify reconciliation (should be zero level mismatches) --------------
  const { data: mismatches } = await db.rpc("reconcile_stock");
  console.log("");
  console.log("=================================================================");
  console.log(" ConsignTrack seed complete");
  console.log("=================================================================");
  console.log(` Stock reconciliation mismatches: ${(mismatches ?? []).length} (expected 0)`);
  console.log("");
  console.log(" Demo logins (email / password):");
  console.log(`  Admin            ${CREDS.admin.email} / ${CREDS.admin.password}`);
  console.log(`  Consignor        ${CREDS.consignor.email} / ${CREDS.consignor.password}   (Maria's Weaves)`);
  console.log(`  Store manager    ${CREDS.kultura.email} / ${CREDS.kultura.password}       (Kultura — SM Aura)`);
  console.log(`  Store manager    ${CREDS.baguio.email} / ${CREDS.baguio.password}       (Baguio — OVERDUE settlement)`);
  console.log(`  Store manager    ${CREDS.ilocos.email} / ${CREDS.ilocos.password}       (Ilocos — seeded discrepancy)`);
  console.log(`  Store staff      ${CREDS.staff.email} / ${CREDS.staff.password}       (Kultura, restricted role)`);
  console.log("=================================================================");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
