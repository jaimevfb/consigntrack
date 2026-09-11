"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { recordReturn } from "@/app/_actions/ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SellableItem } from "@/components/sale-entry";

export function ReturnForm({ storeId, items }: { storeId: string; items: SellableItem[] }) {
  const router = useRouter();
  const key = (i: SellableItem) => `${i.productId}:${i.consignorId}`;
  const [selected, setSelected] = React.useState(items[0] ? key(items[0]) : "");
  const [qty, setQty] = React.useState("1");
  const [reason, setReason] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const item = items.find((i) => key(i) === selected);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!item) {
      setError("Select an item.");
      return;
    }
    setSaving(true);
    const res = await recordReturn({
      store_id: storeId,
      product_id: item.productId,
      consignor_id: item.consignorId,
      qty: Number(qty),
      reason,
      return_date: date,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setQty("1");
    setReason("");
    setOk(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record a return</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={key(i)} value={key(i)}>
                    {i.name} — {i.consignorName} ({i.onHand} on hand)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                max={item?.onHand}
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rdate">Return date</Label>
              <Input id="rdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Unsold, damaged, end of season…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          {ok ? <p className="text-sm text-ok-foreground">Return recorded.</p> : null}
          <Button type="submit" disabled={saving || items.length === 0}>
            {saving ? "Recording…" : "Record return"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
