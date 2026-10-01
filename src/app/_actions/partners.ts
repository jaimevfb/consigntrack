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
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/consignor/partners");
  revalidatePath("/store/partners");
  return { ok: true };
}
