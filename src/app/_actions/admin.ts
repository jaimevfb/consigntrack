"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/_actions/ledger";

function clean(msg: string) {
  return msg.replace(/^.*?:\s*/, "");
}

// ---------------------------------------------------------------------------
// Issue a consignor account (admin only).
// ---------------------------------------------------------------------------
const consignorSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Contact name is required"),
  org_name: z.string().min(1, "Business name is required"),
  contact: z.string().optional(),
});

export async function createConsignorAccount(input: unknown): Promise<ActionResult> {
  const parsed = consignorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_create_consignor", {
    p_email: parsed.data.email,
    p_password: parsed.data.password,
    p_full_name: parsed.data.full_name,
    p_org_name: parsed.data.org_name,
    p_contact: parsed.data.contact ?? null,
  });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/agreements");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Issue a consignee (store) account connected to a consignor (admin only).
// This also forms the agreement, so the store sees the consignor's products.
// ---------------------------------------------------------------------------
const storeSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Manager name is required"),
  store_name: z.string().min(1, "Store name is required"),
  location: z.string().optional(),
  contact: z.string().optional(),
  consignor_id: z.string().uuid("Select the connected consignor"),
  commission_pct: z.coerce.number().min(0).max(100),
  cadence: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
  damage_liability: z.enum(["consignor", "store", "shared"]).default("consignor"),
  damage_store_share_pct: z.coerce.number().min(0).max(100).default(50),
  consignment_period_days: z.coerce.number().int().positive().default(60),
  end_of_period_action: z.enum(["return", "extend", "discount"]).default("return"),
});

export async function issueStoreAccount(input: unknown): Promise<ActionResult> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_issue_store_account", {
    p_email: d.email,
    p_password: d.password,
    p_full_name: d.full_name,
    p_store_name: d.store_name,
    p_consignor_id: d.consignor_id,
    p_commission_pct: d.commission_pct,
    p_cadence: d.cadence,
    p_location: d.location ?? null,
    p_contact: d.contact ?? null,
    p_damage_liability: d.damage_liability,
    p_damage_store_share_pct: d.damage_store_share_pct,
    p_consignment_period_days: d.consignment_period_days,
    p_end_of_period_action: d.end_of_period_action,
  });
  if (error) return { ok: false, error: clean(error.message) };
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/agreements");
  return { ok: true };
}
