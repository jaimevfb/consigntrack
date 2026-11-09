"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/_actions/ledger";

const schema = z.object({
  consignor_id: z.string().uuid(),
  store_id: z.string().uuid(),
  commission_pct: z.coerce.number().min(0).max(100),
  cadence: z.enum(["weekly", "monthly", "quarterly"]),
  damage_liability: z.enum(["consignor", "store", "shared"]).default("consignor"),
  damage_store_share_pct: z.coerce.number().min(0).max(100).default(50),
  consignment_period_days: z.coerce.number().int().positive().default(60),
  end_of_period_action: z.enum(["return", "extend", "discount"]).default("return"),
});

export async function connectPartner(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error } = await supabase.rpc("connect_agreement", {
    p_consignor_id: parsed.data.consignor_id,
    p_store_id: parsed.data.store_id,
    p_commission_pct: parsed.data.commission_pct,
    p_cadence: parsed.data.cadence,
    p_damage_liability: parsed.data.damage_liability,
    p_damage_store_share_pct: parsed.data.damage_store_share_pct,
    p_consignment_period_days: parsed.data.consignment_period_days,
    p_end_of_period_action: parsed.data.end_of_period_action,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/consignor/partners");
  revalidatePath("/store/partners");
  return { ok: true };
}
