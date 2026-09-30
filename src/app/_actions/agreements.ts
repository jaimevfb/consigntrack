"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/_actions/ledger";

const updateSchema = z.object({
  id: z.string().uuid(),
  commission_pct: z.coerce.number().min(0).max(100),
  settlement_cadence: z.enum(["weekly", "monthly", "quarterly"]),
  is_active: z.boolean(),
});

export async function updateAgreement(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase
    .from("agreements")
    .update({
      commission_pct: parsed.data.commission_pct,
      settlement_cadence: parsed.data.settlement_cadence,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/agreements");
  return { ok: true };
}

const createSchema = z.object({
  consignor_id: z.string().uuid(),
  store_id: z.string().uuid(),
  commission_pct: z.coerce.number().min(0).max(100),
  settlement_cadence: z.enum(["weekly", "monthly", "quarterly"]),
});

export async function createAgreement(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.from("agreements").insert({
    consignor_id: parsed.data.consignor_id,
    store_id: parsed.data.store_id,
    commission_pct: parsed.data.commission_pct,
    settlement_cadence: parsed.data.settlement_cadence,
    is_active: true,
  });
  if (error) {
    const msg = error.message.includes("agreements_active_pair")
      ? "An active agreement already exists for that consignor + store."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/admin/agreements");
  return { ok: true };
}
