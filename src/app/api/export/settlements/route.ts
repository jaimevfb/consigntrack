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
    .from("settlements")
    .select("period_start, period_end, gross_sales, commission, returns_total, damage_total, net_payable, status, created_at, agreements!inner(store_id, consignor_id, consignors(name), stores(name)), payments(method, reference, amount, paid_at, confirmed_at), settlement_lines(qty_sold, gross, unit_price, commission_pct, commission, products(sku, name))")
    .order("period_end", { ascending: false });
  if ((role === "store_manager" || role === "store_staff") && store_id) q = q.eq("agreements.store_id", store_id);
  else if (role === "consignor" && consignor_id) q = q.eq("agreements.consignor_id", consignor_id);

  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<{
    period_start: string; period_end: string; gross_sales: number; commission: number; returns_total: number; damage_total: number; net_payable: number; status: string; created_at: string;
    agreements: { consignors: { name: string } | null; stores: { name: string } | null } | null;
    payments: { method: string | null; reference: string | null; amount: number | null; paid_at: string | null; confirmed_at: string | null }[];
    settlement_lines: { qty_sold: number; gross: number; unit_price: number | null; commission_pct: number | null; commission: number; products: { sku: string; name: string } | null }[];
  }>;

  // One row per settlement line (flattened with statement header) — accountant-friendly.
  const header = ["Period start", "Period end", "Consignor", "Store", "Status", "Product SKU", "Product", "Qty sold", "Unit price", "Line gross", "Commission %", "Line commission", "Line net", "Statement gross", "Statement commission", "Statement returns", "Statement damage", "Statement net payable", "Payment method", "Payment ref", "Paid at", "Confirmed at"];
  const body: (string | number | null)[][] = [];
  for (const s of rows) {
    const pay = s.payments?.[0];
    const base = [s.agreements?.consignors?.name ?? "", s.agreements?.stores?.name ?? "", s.status];
    const tail = [s.gross_sales, s.commission, s.returns_total, s.damage_total, s.net_payable, pay?.method ?? "", pay?.reference ?? "", pay?.paid_at ?? "", pay?.confirmed_at ?? ""];
    const lines = s.settlement_lines ?? [];
    if (lines.length === 0) {
      body.push([s.period_start, s.period_end, ...base, "", "(no line detail)", "", "", "", "", "", "", ...tail]);
    } else {
      for (const l of lines) {
        body.push([s.period_start, s.period_end, ...base, l.products?.sku ?? "", l.products?.name ?? "", l.qty_sold, l.unit_price ?? "", l.gross, l.commission_pct ?? "", l.commission, l.gross - l.commission, ...tail]);
      }
    }
  }

  const out = csv([header, ...body]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(out, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consigntrack-settlements-${stamp}.csv"`,
    },
  });
}
