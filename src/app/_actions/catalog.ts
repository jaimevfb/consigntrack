"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import type { ActionResult } from "@/app/_actions/ledger";
import { UNIT_KEYS } from "@/lib/units";

// SKUs are system-issued (DB trigger), never accepted from the client.
const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit_price: z.coerce.number().nonnegative(),
  unit_of_measure: z.enum(UNIT_KEYS).default("piece"),
});

export async function createProduct(input: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  const session = await getSessionProfile();
  if (!session?.profile.consignor_id) return { ok: false, error: "Only consignor accounts manage a catalogue." };

  const supabase = createClient();
  const { error } = await supabase.from("products").insert({
    consignor_id: session.profile.consignor_id,
    name: parsed.data.name,
    unit_price: parsed.data.unit_price,
    unit_of_measure: parsed.data.unit_of_measure,
    // sku omitted — the set_product_sku trigger issues a unique one.
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  unit_price: z.coerce.number().nonnegative(),
  unit_of_measure: z.enum(UNIT_KEYS).default("piece"),
});

export async function updateProduct(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      unit_price: parsed.data.unit_price,
      unit_of_measure: parsed.data.unit_of_measure,
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true };
}
