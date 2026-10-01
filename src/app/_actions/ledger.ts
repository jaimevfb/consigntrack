"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------
const deliveryLineSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
});

const createDeliverySchema = z.object({
  store_id: z.string().uuid(),
  agreement_id: z.string().uuid().nullable().optional(),
  delivery_date: z.string(),
  lines: z.array(deliveryLineSchema).min(1),
  send: z.boolean().default(true),
});

export async function createDelivery(input: unknown): Promise<ActionResult & { deliveryId?: string }> {
  const parsed = createDeliverySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { store_id, agreement_id, delivery_date, lines } = parsed.data;

  // A delivery now mints one QR-tracked item per unit; dispatch/receipt happen by
  // scanning those QRs. This is the single, foolproof logistics pipeline.
  const supabase = createClient();
  const { data: deliveryId, error } = await supabase.rpc("create_delivery_items", {
    p_store_id: store_id,
    p_agreement_id: agreement_id ?? null,
    p_delivery_date: delivery_date,
    p_lines: lines,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/consignor/deliveries");
  revalidatePath("/store/deliveries");
  return { ok: true, deliveryId: deliveryId as string };
}

export async function confirmDelivery(deliveryId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("confirm_delivery", { p_delivery_id: deliveryId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/store/deliveries");
  revalidatePath("/store");
  revalidatePath("/store/inventory");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sales (BR1 enforced in the DB)
// ---------------------------------------------------------------------------
const saleSchema = z.object({
  store_id: z.string().uuid(),
  lines: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.coerce.number().int().positive(),
        unit_price: z.coerce.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

export async function recordSale(input: unknown): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sale" };
  const supabase = createClient();
  const { error } = await supabase.rpc("record_sale", {
    p_store_id: parsed.data.store_id,
    p_lines: parsed.data.lines,
  });
  if (error) {
    // Surface the BR1 oversell rejection in plain language.
    const msg = error.message.includes("BR1")
      ? "Sale rejected: not enough stock on hand for one or more items."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/store/sales");
  revalidatePath("/store");
  revalidatePath("/store/inventory");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Returns (BR6)
// ---------------------------------------------------------------------------
const returnSchema = z.object({
  store_id: z.string().uuid(),
  product_id: z.string().uuid(),
  consignor_id: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
  reason: z.string().optional(),
  return_date: z.string(),
});

export async function recordReturn(input: unknown): Promise<ActionResult> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid return" };
  const supabase = createClient();
  const { error } = await supabase.rpc("record_return", {
    p_store_id: parsed.data.store_id,
    p_product_id: parsed.data.product_id,
    p_consignor_id: parsed.data.consignor_id,
    p_qty: parsed.data.qty,
    p_reason: parsed.data.reason ?? null,
    p_return_date: parsed.data.return_date,
  });
  if (error) {
    const msg = error.message.includes("BR1")
      ? "Return rejected: quantity exceeds stock on hand."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/store/returns");
  revalidatePath("/store/inventory");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settlements (BR3, BR7)
// ---------------------------------------------------------------------------
const generateSchema = z.object({
  agreement_id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
});

export async function generateSettlement(input: unknown): Promise<ActionResult> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid period" };
  const supabase = createClient();
  const { error } = await supabase.rpc("generate_settlement", {
    p_agreement_id: parsed.data.agreement_id,
    p_period_start: parsed.data.period_start,
    p_period_end: parsed.data.period_end,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/store/settlements");
  revalidatePath("/consignor/settlements");
  return { ok: true };
}

export async function markSettlementPaid(settlementId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_settlement_paid", { p_settlement_id: settlementId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/store/settlements");
  revalidatePath("/consignor/settlements");
  return { ok: true };
}

export async function confirmPaymentReceived(settlementId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("confirm_payment_received", { p_settlement_id: settlementId });
  if (error) {
    const msg = error.message.includes("BR7")
      ? "You can only confirm receipt after the store has marked payment as paid."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/consignor/settlements");
  revalidatePath("/store/settlements");
  return { ok: true };
}
