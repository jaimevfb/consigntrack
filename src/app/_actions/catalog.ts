"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import type { ActionResult } from "@/app/_actions/ledger";
import { UNIT_KEYS } from "@/lib/units";

// SKUs are system-issued (DB trigger), never accepted from the client.
const baseShape = {
  name: z.string().min(1, "Name is required"),
  unit_price: z.coerce.number().nonnegative(),
  unit_of_measure: z.enum(UNIT_KEYS).default("piece"),
  category: z.string().trim().min(1).max(40).default("Other"),
  variant: z.string().optional(),
  description: z.string().optional(),
  cost: z.coerce.number().nonnegative().optional(),
  photo_url: z.string().optional(),
  perishable: z.coerce.boolean().optional(),
  shelf_life_days: z.coerce.number().int().positive().optional(),
  opening_stock: z.coerce.number().int().nonnegative().optional(),
};

function payload(d: z.infer<z.ZodObject<typeof baseShape>>) {
  return {
    name: d.name,
    unit_price: d.unit_price,
    unit_of_measure: d.unit_of_measure,
    category: d.category,
    variant: d.variant?.trim() || null,
    description: d.description?.trim() || null,
    cost: d.cost ?? null,
    photo_url: d.photo_url?.trim() || null,
    perishable: d.category === "Food" || d.category === "Beverages" ? true : !!d.perishable,
    shelf_life_days: d.category === "Food" || d.category === "Beverages" ? (d.shelf_life_days ?? 180) : (d.shelf_life_days ?? null),
  };
}

export async function createProduct(input: unknown): Promise<ActionResult> {
  const parsed = z.object(baseShape).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  const session = await getSessionProfile();
  if (!session?.profile.consignor_id) return { ok: false, error: "Only consignor accounts manage a catalogue." };

  const supabase = createClient();
  // Similar-name guard (case-insensitive) unless a variant distinguishes it.
  const { data: dupe } = await supabase.from("products")
    .select("sku, variant").eq("consignor_id", session.profile.consignor_id).ilike("name", parsed.data.name).maybeSingle();
  if (dupe && !(parsed.data.variant && parsed.data.variant.trim() && dupe.variant !== parsed.data.variant.trim())) {
    return { ok: false, error: `Similar product exists (${dupe.sku}) — edit it, or add a variant to tell them apart.` };
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({ consignor_id: session.profile.consignor_id, ...payload(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Optional opening stock → warehouse intake (ledger-backed), so the product
  // starts with real on-hand instead of zero.
  const opening = parsed.data.opening_stock ?? 0;
  if (created?.id && opening > 0) {
    const { error: whErr } = await supabase.rpc("warehouse_intake", { p_sku: created.id, p_qty: opening, p_note: "Opening stock" });
    if (whErr) return { ok: false, error: `Product saved, but opening stock failed: ${whErr.message}` };
  }
  revalidatePath("/consignor/products");
  return { ok: true };
}

/** Mint N serialized piece-barcodes for a product; returns the new serials. */
export async function mintPieceLabels(input: unknown): Promise<ActionResult & { serials?: string[] }> {
  const parsed = z.object({ sku_id: z.string().uuid(), qty: z.coerce.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mint_units", { p_sku: parsed.data.sku_id, p_qty: parsed.data.qty });
  if (error) return { ok: false, error: error.message };
  const serials = Array.isArray(data) ? data.map((r: unknown) => (typeof r === "string" ? r : (r as { mint_units?: string })?.mint_units ?? "")).filter(Boolean) : [];
  revalidatePath("/consignor/products");
  return { ok: true, serials };
}

/** In-stock piece serials for a product (for printing labels). */
export async function listPieceSerials(skuId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase.from("product_units").select("serial").eq("product_id", skuId).eq("status", "in_stock").order("serial");
  return ((data ?? []) as { serial: string }[]).map((r) => r.serial);
}

/** Add warehouse stock for a product (ledger-backed PRODUCE entry). */
export async function receiveStock(input: unknown): Promise<ActionResult & { onHand?: number }> {
  const parsed = z.object({
    sku_id: z.string().uuid(),
    qty: z.coerce.number().int().positive("Enter a quantity of at least 1"),
    note: z.string().max(120).optional(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid stock entry" };
  const session = await getSessionProfile();
  if (!session?.profile.consignor_id && session?.profile.role !== "admin") {
    return { ok: false, error: "Only consignor accounts can add stock." };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("warehouse_intake", { p_sku: parsed.data.sku_id, p_qty: parsed.data.qty, p_note: parsed.data.note ?? null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true, onHand: typeof data === "number" ? data : undefined };
}

export async function updateProduct(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), ...baseShape }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  const supabase = createClient();
  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from("products").update(payload(rest)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true };
}

/**
 * Remove a product from the catalogue. Hard-deletes a product that was never
 * used; if it's referenced by any stock/package/settlement history, it is
 * archived instead so the audit trail stays intact.
 */
export async function removeProduct(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product" };
  const session = await getSessionProfile();
  if (!session?.profile.consignor_id) return { ok: false, error: "Only consignor accounts manage a catalogue." };
  const supabase = createClient();
  const consignorId = session.profile.consignor_id;

  const { error: delErr } = await supabase.from("products").delete().eq("id", parsed.data.id).eq("consignor_id", consignorId);
  if (delErr) {
    const { error: arcErr } = await supabase.from("products").update({ status: "archived" }).eq("id", parsed.data.id).eq("consignor_id", consignorId);
    if (arcErr) return { ok: false, error: arcErr.message };
  }
  revalidatePath("/consignor/products");
  return { ok: true };
}
