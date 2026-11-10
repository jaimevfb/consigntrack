"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import type { ActionResult } from "@/app/_actions/ledger";
import { UNIT_KEYS } from "@/lib/units";

const CATEGORIES = ["Weaves", "Jewelry", "Home", "Food", "Other"] as const;

// SKUs are system-issued (DB trigger), never accepted from the client.
const baseShape = {
  name: z.string().min(1, "Name is required"),
  unit_price: z.coerce.number().nonnegative(),
  unit_of_measure: z.enum(UNIT_KEYS).default("piece"),
  category: z.enum(CATEGORIES).default("Other"),
  variant: z.string().optional(),
  description: z.string().optional(),
  cost: z.coerce.number().nonnegative().optional(),
  photo_url: z.string().optional(),
  perishable: z.coerce.boolean().optional(),
  shelf_life_days: z.coerce.number().int().positive().optional(),
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
    perishable: d.category === "Food" ? true : !!d.perishable,
    shelf_life_days: d.category === "Food" ? (d.shelf_life_days ?? 180) : (d.shelf_life_days ?? null),
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

  const { error } = await supabase.from("products").insert({ consignor_id: session.profile.consignor_id, ...payload(parsed.data) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true };
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
