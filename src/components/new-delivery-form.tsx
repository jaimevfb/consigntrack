"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createDelivery } from "@/app/_actions/ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPHP } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface StoreOption {
  agreementId: string;
  storeId: string;
  name: string;
}

interface Line {
  product_id: string;
  qty: string;
  unit_price: string;
}

export function NewDeliveryForm({ stores, products }: { stores: StoreOption[]; products: Product[] }) {
  const router = useRouter();
  const [agreementId, setAgreementId] = React.useState(stores[0]?.agreementId ?? "");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = React.useState<Line[]>([{ product_id: "", qty: "1", unit_price: "" }]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const store = stores.find((s) => s.agreementId === agreementId);
  const productById = React.useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products],
  );

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { product_id: "", qty: "1", unit_price: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce(
    (a, l) => a + (Number(l.qty) || 0) * (Number(l.unit_price) || 0),
    0,
  );

  async function submit() {
    setError(null);
    if (!store) {
      setError("Select a store.");
      return;
    }
    const cleanLines = lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price || productById[l.product_id]?.unit_price || 0),
      }));
    if (cleanLines.length === 0) {
      setError("Add at least one product line.");
      return;
    }
    setSaving(true);
    const res = await createDelivery({
      store_id: store.storeId,
      agreement_id: store.agreementId,
      delivery_date: date,
      lines: cleanLines,
      send: true,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(res.deliveryId ? `/consignor/deliveries/${res.deliveryId}` : "/consignor/deliveries");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Delivery details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Store</Label>
            <Select value={agreementId} onValueChange={setAgreementId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.agreementId} value={s.agreementId}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ddate">Delivery date</Label>
            <Input id="ddate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Line items</Label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-6 space-y-1">
                <Select
                  value={l.product_id}
                  onValueChange={(v) =>
                    setLine(i, {
                      product_id: v,
                      unit_price: l.unit_price || String(productById[v]?.unit_price ?? ""),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label="Quantity"
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Unit price"
                  placeholder="Unit price"
                  value={l.unit_price}
                  onChange={(e) => setLine(i, { unit_price: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>

        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between">
        <div className="text-sm text-muted-foreground">
          Total value <span className="tnum ml-1 font-medium text-foreground">{formatPHP(total)}</span>
        </div>
        <Button disabled={saving} onClick={() => submit()}>
          {saving ? "Creating…" : "Create delivery & issue QR labels"}
        </Button>
      </CardFooter>
    </Card>
  );
}
