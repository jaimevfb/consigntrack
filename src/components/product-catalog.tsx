"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Check, X, Package, Copy, Trash2 } from "lucide-react";
import { createProduct, updateProduct, removeProduct } from "@/app/_actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { formatPHP } from "@/lib/utils";
import { UNITS, unitShort } from "@/lib/units";
import type { Product } from "@/lib/types";

const CATEGORIES = ["Weaves", "Apparel", "Jewelry", "Bags", "Accessories", "Home", "Ceramics", "Woodwork", "Food", "Beverages", "Beauty", "Wellness", "Stationery", "Crafts", "Art", "Toys", "Other"];
type Draft = { name: string; category: string; otherText: string; variant: string; unit: string; price: string; cost: string; photo_url: string; description: string };
const EMPTY: Draft = { name: "", category: "Weaves", otherText: "", variant: "", unit: "piece", price: "", cost: "", photo_url: "", description: "" };

function resolveCategory(d: { category: string; otherText: string }) {
  return d.category === "Other" ? (d.otherText.trim() || "Other") : d.category;
}
function toPayload(d: Draft) {
  return { name: d.name, category: resolveCategory(d), variant: d.variant || undefined, unit_of_measure: d.unit, unit_price: Number(d.price) || 0, cost: d.cost ? Number(d.cost) : undefined, photo_url: d.photo_url || undefined, description: d.description || undefined };
}

export function ProductCatalog({ products }: { products: Product[] }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  async function remove(id: string) {
    setRemovingId(id);
    const res = await removeProduct({ id });
    setRemovingId(null); setConfirmId(null);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  async function add(e: React.FormEvent, another: boolean) {
    e.preventDefault();
    setError(null); setBusy(true);
    const res = await createProduct(toPayload(draft));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // "Add another like this" keeps category/unit/price; clears name/variant.
    setDraft(another ? { ...draft, name: "", variant: "", photo_url: "", description: "" } : EMPTY);
    if (!another) setAdding(false);
    router.refresh();
  }

  const visible = products.filter((p) => p.status !== "archived");

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New product</CardTitle>
            <p className="text-xs text-muted-foreground">A unique SKU is issued automatically. Use <strong>Save &amp; add another</strong> to enter colorways fast.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => add(e, false)} className="grid gap-4 sm:grid-cols-6">
              <Field className="sm:col-span-3" label="Name"><Input value={draft.name} onChange={(e) => set("name", e.target.value)} required /></Field>
              <Field className="sm:col-span-2" label="Category">
                <Select value={draft.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                {draft.category === "Other" ? <Input value={draft.otherText} onChange={(e) => set("otherText", e.target.value)} placeholder="Type a category" className="mt-1.5" autoFocus /> : null}
              </Field>
              <Field label="Variant"><Input value={draft.variant} onChange={(e) => set("variant", e.target.value)} placeholder="e.g. Red" /></Field>
              <Field className="sm:col-span-2" label="Unit">
                <Select value={draft.unit} onValueChange={(v) => set("unit", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label} ({u.short})</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field label="Price (₱)"><Input type="number" inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} required /></Field>
              <Field label="Cost (₱, private)"><Input type="number" inputMode="decimal" value={draft.cost} onChange={(e) => set("cost", e.target.value)} /></Field>
              <Field className="sm:col-span-2" label="Photo URL"><Input value={draft.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" /></Field>
              <Field className="sm:col-span-6" label="Description"><Input value={draft.description} onChange={(e) => set("description", e.target.value)} /></Field>
              {error ? <p className="sm:col-span-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              <div className="sm:col-span-6 flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add product"}</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={(e) => add(e, true)}><Copy className="h-4 w-4" /> Save &amp; add another</Button>
                <Button type="button" variant="ghost" onClick={() => { setAdding(false); setDraft(EMPTY); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New product</Button>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) =>
                  editId === p.id ? (
                    <EditRow key={p.id} product={p} onDone={() => { setEditId(null); router.refresh(); }} onCancel={() => setEditId(null)} />
                  ) : (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {p.photo_url ? <img src={p.photo_url} alt="" className="h-9 w-9 rounded-md border border-border object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground"><Package className="h-4 w-4" /></span>}
                          <div>
                            <div className="font-medium">{p.name}{p.variant ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{p.variant}</span> : null}</div>
                            {p.perishable ? <div className="text-xs text-warn-foreground">Perishable · {p.shelf_life_days}d</div> : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tnum text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell><StatusPill tone="neutral">{p.category}</StatusPill></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{unitShort(p.unit_of_measure)}</TableCell>
                      <TableCell className="tnum text-right">{formatPHP(p.unit_price)}</TableCell>
                      <TableCell className="text-right">
                        {confirmId === p.id ? (
                          <div className="inline-flex items-center justify-end gap-1">
                            <span className="text-xs text-muted-foreground">Remove?</span>
                            <Button variant="ghost" size="sm" className="text-destructive" disabled={removingId === p.id} onClick={() => remove(p.id)}>{removingId === p.id ? "Removing…" : "Yes"}</Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>No</Button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditId(p.id)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => { setError(null); setConfirmId(p.id); }}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
                {visible.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No products yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

function EditRow({ product, onDone, onCancel }: { product: Product; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = React.useState(product.name);
  const [category, setCategory] = React.useState(product.category);
  const [price, setPrice] = React.useState(String(product.unit_price));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateProduct({ id: product.id, name, category, variant: product.variant ?? undefined, unit_of_measure: product.unit_of_measure, unit_price: Number(price) || 0, cost: product.cost ?? undefined, photo_url: product.photo_url ?? undefined, description: product.description ?? undefined });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <TableRow>
      <TableCell><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" /></TableCell>
      <TableCell className="tnum text-xs text-muted-foreground">{product.sku}</TableCell>
      <TableCell><div className="w-32"><Select value={category} onValueChange={setCategory}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{(CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></TableCell>
      <TableCell className="text-sm text-muted-foreground">{unitShort(product.unit_of_measure)}</TableCell>
      <TableCell className="text-right"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-24 text-right tnum" />{err ? <div className="text-xs text-destructive">{err}</div> : null}</TableCell>
      <TableCell className="text-right"><div className="inline-flex gap-1"><Button variant="ghost" size="icon" aria-label="Save" disabled={busy} onClick={save}><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}><X className="h-4 w-4" /></Button></div></TableCell>
    </TableRow>
  );
}
