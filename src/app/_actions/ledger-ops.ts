"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/_actions/ledger";

function clean(msg: string) {
  return msg.replace(/^.*?:\s*/, "");
}

export interface ReceiveLine {
  line_id: string;
  qty_received: number;
  qty_disputed?: number;
  photo?: string | null;
}

export async function receivePackage(packageId: string, lines: ReceiveLine[]): Promise<ActionResult & { status?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("receive_package", { p_package_id: packageId, p_lines: lines });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/store");
  revalidatePath("/store/deliveries");
  revalidatePath("/store/inventory");
  return { ok: true, status: data as string };
}

export interface SaleLine { sku_id: string; qty: number; unit_price?: number }

export async function posSale(storeId: string, lines: SaleLine[], source = "MANUAL"): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("pos_sale", { p_consignee: storeId, p_lines: lines, p_source: source });
  if (error) {
    const msg = error.message.includes("OVERSELL")
      ? "Sale rejected: not enough stock on hand. " + clean(error.message)
      : clean(error.message);
    return { ok: false, error: msg };
  }
  revalidatePath("/store/sales");
  revalidatePath("/store");
  revalidatePath("/store/inventory");
  return { ok: true };
}

export async function buildReturnPackage(consignorId: string, storeId: string, lines: { sku_id: string; qty: number }[]): Promise<ActionResult & { packageId?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("build_return_package", { p_consignor: consignorId, p_consignee: storeId, p_lines: lines });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/store/returns");
  revalidatePath("/store/inventory");
  revalidatePath("/store");
  return { ok: true, packageId: data as string };
}

export async function adjustStock(storeId: string, skuId: string, qty: number, reason: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("adjust_stock", { p_consignee: storeId, p_sku: skuId, p_qty: qty, p_reason: reason });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/store/inventory");
  revalidatePath("/store");
  return { ok: true };
}

export async function resolveDispute(packageId: string, skuId: string, qty: number, received: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_dispute", { p_package_id: packageId, p_sku: skuId, p_qty: qty, p_received: received });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/store/deliveries");
  revalidatePath("/store/inventory");
  return { ok: true };
}

export async function generateLedgerSettlement(agreementId: string, periodStart: string, periodEnd: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("generate_settlement_ledger", { p_agreement_id: agreementId, p_period_start: periodStart, p_period_end: periodEnd });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/store/settlements");
  revalidatePath("/consignor/settlements");
  return { ok: true };
}

export async function dispatchPackageAction(packageId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("dispatch_package", { p_package_id: packageId });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/consignor/shipments");
  revalidatePath("/store/deliveries");
  return { ok: true };
}

// Consignor side — build + dispatch an outbound package (replaces delivery minting).
export async function createOutboundPackage(consignorId: string, storeId: string, lines: { sku_id: string; qty: number }[], dispatch = true): Promise<ActionResult & { packageId?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_outbound_package", { p_consignor: consignorId, p_consignee: storeId, p_lines: lines });
  if (error) return { ok: false, error: clean(error.message) };
  const packageId = data as string;
  if (dispatch) {
    const { error: dErr } = await supabase.rpc("dispatch_package", { p_package_id: packageId });
    if (dErr) return { ok: false, error: clean(dErr.message) };
  }
  revalidatePath("/consignor/deliveries");
  revalidatePath("/store/deliveries");
  return { ok: true, packageId };
}
