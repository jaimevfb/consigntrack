"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Check, X } from "lucide-react";
import { createProduct, updateProduct } from "@/app/_actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils";
import { UNITS, unitLabel } from "@/lib/units";
import type { Product } from "@/lib/types";

function UnitSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {UNITS.map((u) => (
          <SelectItem key={u.key} value={u.key}>
            {u.label} ({u.short})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProductCatalog({ products }: { products: Product[] }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("piece");
  const [price, setPrice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createProduct({ name, unit_of_measure: unit, unit_price: Number(price) || 0 });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setName(""); setUnit("piece"); setPrice(""); setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New product</CardTitle>
            <p className="text-xs text-muted-foreground">A unique SKU is issued automatically once you save.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pn">Name</Label>
                <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu">Unit of measure</Label>
                <UnitSelect id="pu" value={unit} onChange={setUnit} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp">Unit price (₱)</Label>
                <Input id="pp" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              {error ? <p className="sm:col-span-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              <div className="sm:col-span-4 flex gap-2">
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add product"}</Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New product
        </Button>
      )}

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) =>
                editId === p.id ? (
                  <EditRow key={p.id} product={p} onDone={() => { setEditId(null); router.refresh(); }} onCancel={() => setEditId(null)} />
                ) : (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="tnum text-xs text-muted-foreground">{p.sku}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{unitLabel(p.unit_of_measure)}</TableCell>
                    <TableCell className="tnum text-right">{formatPHP(p.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditId(p.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No products yet. Add your first to start building deliveries and items.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditRow({ product, onDone, onCancel }: { product: Product; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = React.useState(product.name);
  const [unit, setUnit] = React.useState(product.unit_of_measure ?? "piece");
  const [price, setPrice] = React.useState(String(product.unit_price));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await updateProduct({ id: product.id, name, unit_of_measure: unit, unit_price: Number(price) || 0 });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <TableRow>
      <TableCell><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" /></TableCell>
      <TableCell className="tnum text-xs text-muted-foreground">{product.sku}</TableCell>
      <TableCell><div className="w-32"><UnitSelect id={`u-${product.id}`} value={unit} onChange={setUnit} /></div></TableCell>
      <TableCell className="text-right">
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-24 text-right tnum" />
        {err ? <div className="text-xs text-destructive">{err}</div> : null}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Save" disabled={busy} onClick={save}><Check className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}><X className="h-4 w-4" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
