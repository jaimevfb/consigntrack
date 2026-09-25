"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { createItem } from "@/app/_actions/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface StoreOption {
  agreementId: string;
  storeId: string;
  name: string;
}

export function CreateItemForm({ stores }: { stores: StoreOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [agreementId, setAgreementId] = React.useState(stores[0]?.agreementId ?? "");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [condition, setCondition] = React.useState("New");
  const [price, setPrice] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okCode, setOkCode] = React.useState<string | null>(null);

  const store = stores.find((s) => s.agreementId === agreementId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkCode(null);
    if (!store) return setError("Select a destination store.");
    setSaving(true);
    const res = await createItem({
      store_id: store.storeId,
      agreement_id: store.agreementId,
      description,
      asking_price: Number(price) || 0,
      category: category || undefined,
      condition: condition || undefined,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOkCode(res.code ?? "created");
    setDescription("");
    setPrice("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} disabled={stores.length === 0}>
        <Plus className="h-4 w-4" /> New tracked item
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New tracked item</CardTitle>
        <p className="text-xs text-muted-foreground">A signed QR label is issued automatically.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Destination store</Label>
              <Select value={agreementId} onValueChange={setAgreementId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
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
              <Label htmlFor="price">Asking price (₱)</Label>
              <Input id="price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="e.g. Handwoven wall tapestry (1/1)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat">Category</Label>
              <Input id="cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Textile" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cond">Condition</Label>
              <Input id="cond" value={condition} onChange={(e) => setCondition(e.target.value)} />
            </div>
          </div>
          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {okCode ? (
            <p className="flex items-center gap-1.5 text-sm text-ok-foreground">
              <Check className="h-4 w-4" /> Item {okCode} created and labeled.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create & issue label"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
