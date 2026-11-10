"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Settlement payment (cashless demo). Stock/sales/returns all go through the
// ledger-ops actions now; this file keeps only the payment confirmation pair.

export async function markSettlementPaid(
  settlementId: string,
  method: string = "gcash",
  reference?: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_settlement_paid", {
    p_settlement_id: settlementId,
    p_method: method,
    p_reference: reference ?? null,
  });
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
