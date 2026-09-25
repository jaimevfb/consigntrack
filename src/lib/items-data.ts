import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Item, ScanEvent } from "@/lib/types";

export interface ItemRow extends Item {
  stores: { name: string } | null;
  consignors: { name: string } | null;
}

export const getItems = cache(async (): Promise<ItemRow[]> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("items")
    .select("*, stores(name), consignors(name)")
    .order("updated_at", { ascending: false });
  return (data ?? []) as unknown as ItemRow[];
});

export interface ItemDetail {
  item: ItemRow;
  events: ScanEvent[];
  disputes: { id: string; subject: string; status: string; resolution: string | null; created_at: string }[];
  exceptions: { id: string; kind: string; detail: string | null; status: string; created_at: string }[];
}

export async function getItemById(id: string): Promise<ItemDetail | null> {
  const supabase = createClient();
  const [{ data: item }, { data: events }, { data: disputes }, { data: exceptions }] = await Promise.all([
    supabase.from("items").select("*, stores(name), consignors(name)").eq("id", id).maybeSingle(),
    supabase.from("scan_events").select("*").eq("item_id", id).order("created_at", { ascending: true }),
    supabase.from("disputes").select("id, subject, status, resolution, created_at").eq("item_id", id).order("created_at", { ascending: false }),
    supabase.from("exceptions").select("id, kind, detail, status, created_at").eq("item_id", id).order("created_at", { ascending: false }),
  ]);
  if (!item) return null;
  return {
    item: item as unknown as ItemRow,
    events: (events ?? []) as ScanEvent[],
    disputes: (disputes ?? []) as ItemDetail["disputes"],
    exceptions: (exceptions ?? []) as ItemDetail["exceptions"],
  };
}

export interface ExceptionRow {
  id: string;
  kind: string;
  detail: string | null;
  status: string;
  created_at: string;
  items: { code: string; description: string; stores: { name: string } | null; consignors: { name: string } | null } | null;
}

export const getExceptionsQueue = cache(async (openOnly = true): Promise<ExceptionRow[]> => {
  const supabase = createClient();
  let q = supabase
    .from("exceptions")
    .select("id, kind, detail, status, created_at, items(code, description, stores(name), consignors(name))")
    .order("created_at", { ascending: false });
  if (openOnly) q = q.eq("status", "open");
  const { data } = await q;
  return (data ?? []) as unknown as ExceptionRow[];
});

export interface DisputeRow {
  id: string;
  subject: string;
  status: string;
  resolution: string | null;
  created_at: string;
  raised_role: string | null;
  items: { code: string; description: string } | null;
}

export const getDisputesQueue = cache(async (): Promise<DisputeRow[]> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("disputes")
    .select("id, subject, status, resolution, created_at, raised_role, items(code, description)")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as DisputeRow[];
});

/** Counts of items by status for the caller's scope. */
export const getItemStatusCounts = cache(async (): Promise<Record<string, number>> => {
  const items = await getItems();
  const counts: Record<string, number> = {};
  for (const it of items) counts[it.status] = (counts[it.status] ?? 0) + 1;
  return counts;
});
