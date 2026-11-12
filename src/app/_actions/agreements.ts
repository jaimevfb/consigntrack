"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/_actions/ledger";

// Shared commercial-term fields (Q1–Q5). All optional on update.
const termsShape = {
  damage_liability: z.enum(["consignor", "store", "shared"]),
  damage_store_share_pct: z.coerce.number().min(0).max(100),
  consignment_period_days: z.coerce.number().int().positive(),
  end_of_period_action: z.enum(["return", "extend", "discount"]),
  grace_extend_days: z.coerce.number().int().positive(),
  markdown_pct: z.coerce.number().min(0).max(100),
  receipt_grace_days: z.coerce.number().int().positive(),
};

const updateSchema = z.object({
  id: z.string().uuid(),
  commission_pct: z.coerce.number().min(0).max(100),
  settlement_cadence: z.enum(["weekly", "monthly", "quarterly"]),
  is_active: z.boolean(),
  ...Object.fromEntries(Object.entries(termsShape).map(([k, v]) => [k, v.optional()])),
});

export async function updateAgreement(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...fields } = parsed.data;
  const supabase = createClient();
  const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  const { error } = await supabase.from("agreements").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/agreements");
  return { ok: true };
}

export async function terminateAgreement(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.from("agreements").update({ is_active: false }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/agreements");
  revalidatePath("/admin/accounts");
  return { ok: true };
}

const createSchema = z.object({
  consignor_id: z.string().uuid(),
  store_id: z.string().uuid(),
  commission_pct: z.coerce.number().min(0).max(100),
  settlement_cadence: z.enum(["weekly", "monthly", "quarterly"]),
  ...Object.fromEntries(Object.entries(termsShape).map(([k, v]) => [k, v.optional()])),
});

export async function createAgreement(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.from("agreements").insert({
    ...parsed.data,
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

// ---- Q1: per-product commission overrides ---------------------------------
const overrideSchema = z.object({
  agreement_id: z.string().uuid(),
  product_id: z.string().uuid(),
  commission_pct: z.coerce.number().min(0).max(100),
});

export async function setCommissionOverride(input: unknown): Promise<ActionResult> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.rpc("set_commission_override", {
    p_agreement_id: parsed.data.agreement_id,
    p_product_id: parsed.data.product_id,
    p_commission_pct: parsed.data.commission_pct,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/admin/agreements");
  return { ok: true };
}

export async function removeCommissionOverride(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ agreement_id: z.string().uuid(), product_id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_commission_override", {
    p_agreement_id: parsed.data.agreement_id,
    p_product_id: parsed.data.product_id,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/admin/agreements");
  return { ok: true };
}

// ---- Q2/Q5: period maintenance sweep (admin) ------------------------------
export async function runPeriodMaintenance(): Promise<ActionResult & { summary?: unknown }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("run_period_maintenance");
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/admin");
  revalidatePath("/store/deliveries");
  return { ok: true, summary: data };
}
