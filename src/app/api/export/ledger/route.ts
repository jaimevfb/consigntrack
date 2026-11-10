import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function GET() {
  const session = await getSessionProfile();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { role, store_id, consignor_id } = session.profile;
  const supabase = createClient();

  let q = supabase
    .from("ledger_entries")
    .select("created_at, entry_type, qty, unit_price, price_flag, reason, products!inner(sku, name, consignor_id), stores:consignee_id(name)")
    .order("created_at", { ascending: false })
    .limit(5000);
  if ((role === "store_manager" || role === "store_staff") && store_id) q = q.eq("consignee_id", store_id);
  else if (role === "consignor" && consignor_id) q = q.eq("products.consignor_id", consignor_id);

  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<{
    created_at: string; entry_type: string; qty: number; unit_price: number | null; price_flag: boolean | null; reason: string | null;
    products: { sku: string; name: string } | null; stores: { name: string } | null;
  }>;

  const header = ["Date", "Type", "SKU", "Product", "Store", "Qty", "Unit price", "Line value", "Price flag", "Reason"];
  const body = rows.map((r) => [
    new Date(r.created_at).toISOString(),
    r.entry_type,
    r.products?.sku ?? "",
    r.products?.name ?? "",
    r.stores?.name ?? "",
    r.qty,
    r.unit_price ?? "",
    r.unit_price != null ? r.qty * r.unit_price : "",
    r.price_flag ? "yes" : "",
    r.reason ?? "",
  ]);

  const out = csv([header, ...body]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(out, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consigntrack-ledger-${stamp}.csv"`,
    },
  });
}
