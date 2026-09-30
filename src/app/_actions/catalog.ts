"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import type { ActionResult } from "@/app/_actions/ledger";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  unit_price: z.coerce.number().nonnegative(),
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
    sku: parsed.data.sku || null,
    unit_price: parsed.data.unit_price,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sku: z.string().optional(),
  unit_price: z.coerce.number().nonnegative(),
});

export async function updateProduct(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ name: parsed.data.name, sku: parsed.data.sku || null, unit_price: parsed.data.unit_price })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/products");
  return { ok: true };
}
