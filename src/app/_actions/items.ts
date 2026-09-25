"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/_actions/ledger";

const createItemSchema = z.object({
  store_id: z.string().uuid(),
  description: z.string().min(1),
  asking_price: z.coerce.number().nonnegative(),
  category: z.string().optional(),
  condition: z.string().optional(),
  agreement_id: z.string().uuid().nullable().optional(),
});

export async function createItem(input: unknown): Promise<ActionResult & { code?: string }> {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_item", {
    p_store_id: parsed.data.store_id,
    p_description: parsed.data.description,
    p_asking_price: parsed.data.asking_price,
    p_category: parsed.data.category ?? null,
    p_condition: parsed.data.condition ?? null,
    p_agreement_id: parsed.data.agreement_id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/consignor/items");
  return { ok: true, code: (data as { code?: string })?.code };
}

export type ScanResult =
  | { ok: true; status: string; message: string; exception: boolean }
  | { ok: false; error: string };

export async function itemScan(input: {
  token: string;
  event_type: string;
  note?: string;
  sale_price?: number;
  buyer_ref?: string;
}): Promise<ScanResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("item_scan", {
    p_token: input.token,
    p_event_type: input.event_type,
    p_note: input.note ?? null,
    p_sale_price: input.sale_price ?? null,
    p_buyer_ref: input.buyer_ref ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; status: string; message: string; exception: boolean };
  revalidatePath("/store/items");
  revalidatePath("/consignor/items");
  revalidatePath("/store/scan");
  revalidatePath("/admin/exceptions");
  return { ok: true, status: r.status, message: r.message, exception: r.exception };
}

export async function resolveException(id: string, resolution: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_exception", { p_id: id, p_resolution: resolution });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/exceptions");
  revalidatePath("/admin");
  return { ok: true };
}

export async function raiseDispute(itemId: string | null, subject: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("raise_dispute", { p_item_id: itemId, p_subject: subject });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/exceptions");
  return { ok: true };
}

export async function resolveDispute(id: string, resolution: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_dispute", { p_id: id, p_resolution: resolution });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/exceptions");
  return { ok: true };
}
