"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Copy, Trash2, PackagePlus } from "lucide-react";
import { createProduct, updateProduct, removeProduct, receiveStock, mintPieceLabels, listPieceSerials } from "@/app/_actions/catalog";
import { LabelSheet } from "@/components/label-sheet";
import { Barcode as BarcodeIcon } from "lucide-react";
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
type Draft = { name: string; category: string; otherText: string; variant: string; unit: string; price: string; cost: string; photo_url: string; description: string; opening: string };
const EMPTY: Draft = { name: "", category: "Weaves", otherText: "", variant: "", unit: "piece", price: "", cost: "", photo_url: "", description: "", opening: "" };

function resolveCategory(d: { category: string; otherText: string }) {
  return d.category === "Other" ? (d.otherText.trim() || "Other") : d.category;
}
function toPayload(d: Draft) {
  return { name: d.name, category: resolveCategory(d), variant: d.variant || undefined, unit_of_measure: d.unit, unit_price: Number(d.price) || 0, cost: d.cost ? Number(d.cost) : undefined, photo_url: d.photo_url || undefined, description: d.description || undefined, opening_stock: d.opening ? Number(d.opening) : undefined };
}

export function ProductCatalog({ products, stock = {} }: { products: Product[]; stock?: Record<string, number> }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

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
            <form onSubmit={(e) => add(e, false)} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <Field className="sm:col-span-3" label="Name"><Input value={draft.name} onChange={(e) => set("name", e.target.value)} required /></Field>
              <Field className="sm:col-span-2" label="Category">
                <Select value={draft.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                {draft.category === "Other" ? <Input value={draft.otherText} onChange={(e) => set("otherText", e.target.value)} placeholder="Type a category" className="mt-1.5" autoFocus /> : null}
              </Field>
              <Field label="Variant"><Input value={draft.variant} onChange={(e) => set("variant", e.target.value)} placeholder="e.g. Red" /></Field>
              <Field className="sm:col-span-2" label="Unit">
                <Select value={draft.unit} onValueChange={(v) => set("unit", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label} ({u.short})</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field className="sm:col-span-2" label="Price (₱)"><Input type="number" inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} required /></Field>
              <Field className="sm:col-span-2" label="Opening stock"><Input type="number" inputMode="numeric" min={0} value={draft.opening} onChange={(e) => set("opening", e.target.value)} placeholder="e.g. 50" /></Field>
              <Field className="sm:col-span-4" label="Photo URL"><Input value={draft.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" /></Field>
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
                <TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>In warehouse</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="w-10" /></TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id} className="group cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setEditId(p.id)}>
                    <TableCell>
                      <div className="font-medium">{p.name}{p.variant ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{p.variant}</span> : null}</div>
                      {p.perishable ? <div className="text-xs text-warn-foreground">Perishable · {p.shelf_life_days}d</div> : null}
                    </TableCell>
                    <TableCell className="tnum text-xs text-muted-foreground">{p.sku}</TableCell>
                    <TableCell><StatusPill tone="neutral">{p.category}</StatusPill></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{unitShort(p.unit_of_measure)}</TableCell>
                    <TableCell><StockCell product={p} onHand={stock[p.id] ?? 0} /></TableCell>
                    <TableCell className="tnum text-right">{formatPHP(p.unit_price)}</TableCell>
                    <TableCell className="text-right"><Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No products yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editId ? (() => {
        const ep = products.find((p) => p.id === editId);
        return ep ? <ProductEditModal product={ep} onHand={stock[editId] ?? 0} onClose={() => setEditId(null)} onDone={() => { setEditId(null); router.refresh(); }} /> : null;
      })() : null}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

/** Warehouse on-hand, display only. Stock is added from the Edit modal. */
function StockCell({ product, onHand }: { product: Product; onHand: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`tnum text-sm font-medium ${onHand <= 0 ? "text-muted-foreground" : ""}`}>{onHand.toLocaleString("en-PH")}</span>
      <span className="text-xs text-muted-foreground">{unitShort(product.unit_of_measure)}</span>
    </div>
  );
}

function ProductEditModal({ product, onHand, onClose, onDone }: { product: Product; onHand: number; onClose: () => void; onDone: () => void }) {
  const [name, setName] = React.useState(product.name);
  const [category, setCategory] = React.useState(product.category);
  const [variant, setVariant] = React.useState(product.variant ?? "");
  const [unit, setUnit] = React.useState(product.unit_of_measure);
  const [price, setPrice] = React.useState(String(product.unit_price));
  const [addQty, setAddQty] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [stockMsg, setStockMsg] = React.useState<string | null>(null);
  const [onHandLocal, setOnHandLocal] = React.useState(onHand);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [serials, setSerials] = React.useState<string[] | null>(null);
  const [labelBusy, setLabelBusy] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    let on = true;
    listPieceSerials(product.id).then((s) => { if (on) setSerials(s); });
    return () => { on = false; };
  }, [product.id]);

  async function generateAndPrint() {
    setLabelBusy(true);
    const have = serials?.length ?? 0;
    const need = onHandLocal - have;
    if (need > 0) {
      const res = await mintPieceLabels({ sku_id: product.id, qty: need });
      if (!res.ok) { setLabelBusy(false); setStockMsg(res.error); return; }
    }
    const fresh = await listPieceSerials(product.id);
    setSerials(fresh); setLabelBusy(false); setSheetOpen(true);
  }

  async function del() {
    setBusy(true); setErr(null);
    const res = await removeProduct({ id: product.id });
    setBusy(false);
    if (!res.ok) { setErr(res.error); setConfirmDel(false); return; }
    onDone();
  }

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateProduct({ id: product.id, name, category, variant: variant || undefined, unit_of_measure: unit, unit_price: Number(price) || 0, cost: product.cost ?? undefined, photo_url: product.photo_url ?? undefined, description: product.description ?? undefined });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  async function addStock() {
    const n = Number(addQty);
    if (!Number.isFinite(n) || n <= 0) { setStockMsg("Enter a quantity to add."); return; }
    setBusy(true); setStockMsg(null);
    const res = await receiveStock({ sku_id: product.id, qty: n });
    setBusy(false);
    if (!res.ok) { setStockMsg(res.error); return; }
    const next = res.onHand ?? onHandLocal + n;
    setOnHandLocal(next); setAddQty(""); setStockMsg(`Added ${n}. Now ${next.toLocaleString("en-PH")} on hand.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Edit product</h3>
            <div className="tnum mt-0.5 text-xs text-muted-foreground">{product.sku}</div>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field className="sm:col-span-4" label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field className="sm:col-span-2" label="Variant"><Input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="e.g. Red" /></Field>
          <Field className="sm:col-span-3" label="Category"><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          <Field className="sm:col-span-1" label="Unit"><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.short}</SelectItem>)}</SelectContent></Select></Field>
          <Field className="sm:col-span-2" label="Price (₱)"><Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}

        <div className="mt-5 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">In warehouse</div>
            <div className="tnum text-sm"><span className="font-semibold">{onHandLocal.toLocaleString("en-PH")}</span> <span className="text-muted-foreground">{unitShort(product.unit_of_measure)}</span></div>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1 space-y-1.5"><Label>Add stock</Label><Input type="number" inputMode="numeric" min={1} value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder="Quantity to add" /></div>
            <Button type="button" variant="outline" className="gap-1.5" disabled={busy || !addQty} onClick={addStock}><PackagePlus className="h-4 w-4" /> Add</Button>
          </div>
          {stockMsg ? <p className="mt-2 text-xs text-muted-foreground">{stockMsg}</p> : null}
        </div>

        <div className="mt-4 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Piece barcodes</div>
              <div className="text-xs text-muted-foreground">
                {serials === null ? "Loading…" : `${serials.length} of ${onHandLocal} pieces labeled`}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={labelBusy || onHandLocal <= 0} onClick={generateAndPrint}>
              <BarcodeIcon className="h-4 w-4" /> {labelBusy ? "Generating…" : "Generate & print labels"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">One unique barcode per piece. Print the sheet, stick one on each item, and scan it at the store to sell that exact piece.</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
          {confirmDel ? (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Delete this product?</span>
              <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={del}>{busy ? "Deleting…" : "Delete"}</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" /> Delete product</Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </div>
      {sheetOpen ? <LabelSheet name={product.name} serials={serials ?? []} onClose={() => setSheetOpen(false)} /> : null}
    </div>
  );
}
