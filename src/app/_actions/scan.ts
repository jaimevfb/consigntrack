"use server";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ScanLineDTO { line_id: string; sku: string; name: string; qty_expected: number }

export type ScanResult =
  | { kind: "receive"; package: { id: string; pkg_code: string; consignor_name: string; units: number; lines: ScanLineDTO[] } }
  | { kind: "dispatch"; id: string; pkg_code: string; store_name: string; units: number }
  | { kind: "return"; id: string; pkg_code: string; store_name: string; units: number; lines: ScanLineDTO[] }
  | { kind: "sku"; sku: { sku_id: string; sku: string; name: string; unit_price: number; on_hand: number } }
  | { kind: "error"; message: string };

function err(message: string): ScanResult { return { kind: "error", message }; }

export async function resolveScan(rawCode: string): Promise<ScanResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return err("Enter or scan a code.");
  const session = await getSessionProfile();
  if (!session) return err("Please sign in.");
  const { role, store_id, consignor_id } = session.profile;
  const isStore = role === "store_manager" || role === "store_staff" || (role === "admin" && !!store_id);
  const isConsignor = role === "consignor" || (role === "admin" && !!consignor_id);
  const supabase = createClient();

  if (code.startsWith("PKG-") || code.startsWith("RET-")) {
    const { data: pkg } = await supabase
      .from("packages")
      .select("id, pkg_code, direction, status, consignor_id, consignee_id, stores(name), consignors(name), package_lines(id, qty_expected, products(sku, name))")
      .eq("pkg_code", code).maybeSingle();
    if (!pkg) return err(`"${code}" isn't recognized.`);
    const p = pkg as unknown as {
      id: string; pkg_code: string; direction: string; status: string; consignor_id: string; consignee_id: string;
      stores: { name: string } | null; consignors: { name: string } | null;
      package_lines: Array<{ id: string; qty_expected: number; products: { sku: string; name: string } | null }>;
    };
    const lines: ScanLineDTO[] = p.package_lines.map((l) => ({ line_id: l.id, sku: l.products?.sku ?? "—", name: l.products?.name ?? "—", qty_expected: l.qty_expected }));
    const units = p.package_lines.reduce((a, l) => a + l.qty_expected, 0);

    if (p.direction === "OUTBOUND") {
      // Consignor dispatching their own packed package
      if (isConsignor && consignor_id && p.consignor_id === consignor_id) {
        if (p.status === "PACKED") return { kind: "dispatch", id: p.id, pkg_code: p.pkg_code, store_name: p.stores?.name ?? "—", units };
        return err(`${code} is already ${p.status.toLowerCase().replace(/_/g, " ")}.`);
      }
      // Store receiving a package bound to it
      if (isStore && store_id) {
        if (p.consignee_id !== store_id) return err(`Wrong destination — ${code} is for ${p.stores?.name ?? "another store"}.`);
        if (p.status === "IN_TRANSIT") return { kind: "receive", package: { id: p.id, pkg_code: p.pkg_code, consignor_name: p.consignors?.name ?? "—", units, lines } };
        return err(`${code} was already received (${p.status.toLowerCase().replace(/_/g, " ")}).`);
      }
      return err(`${code} can't be actioned from this workspace.`);
    }

    // RETURN package — consignor receives it into the warehouse
    if (isConsignor && consignor_id && p.consignor_id === consignor_id) {
      if (p.status === "RETURN_IN_TRANSIT") return { kind: "return", id: p.id, pkg_code: p.pkg_code, store_name: p.stores?.name ?? "—", units, lines };
      return err(`${code} is already ${p.status.toLowerCase().replace(/_/g, " ")}.`);
    }
    return err(`${code} can't be actioned from this workspace.`);
  }

  // Otherwise treat as a product SKU — consignee sale
  if (!isStore || !store_id) return err(`"${code}" isn't a package or a sellable SKU here.`);
  const { data: prod } = await supabase.from("products").select("id, sku, name, unit_price").ilike("sku", code).maybeSingle();
  if (!prod) return err(`No product with SKU "${code}".`);
  const pr = prod as { id: string; sku: string; name: string; unit_price: number };
  const { data: onHand } = await supabase.rpc("get_on_hand", { p_consignee: store_id, p_sku: pr.id });
  const oh = (onHand as number) ?? 0;
  if (oh <= 0) return err(`${pr.sku} — ${pr.name} is out of stock.`);
  return { kind: "sku", sku: { sku_id: pr.id, sku: pr.sku, name: pr.name, unit_price: pr.unit_price, on_hand: oh } };
}
