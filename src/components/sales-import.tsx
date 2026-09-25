"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, AlertCircle } from "lucide-react";
import { recordSale } from "@/app/_actions/ledger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { formatPHP } from "@/lib/utils";

export interface ImportProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
}

interface ParsedRow {
  line: number;
  rawName: string;
  qty: number;
  price?: number;
  product?: ImportProduct;
  status: "ok" | "unmatched" | "badqty";
}

function parseCSV(text: string): { name: string; qty: string; price?: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Detect + skip a header row
  const first = lines[0].toLowerCase();
  const hasHeader = /sku|product|item|qty|quantity|price/.test(first);
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((l) => {
    const cols = l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return { name: cols[0] ?? "", qty: cols[1] ?? "", price: cols[2] };
  });
}

export function SalesImport({ storeId, products }: { storeId: string; products: ImportProduct[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const bySku = React.useMemo(() => {
    const m = new Map<string, ImportProduct>();
    for (const p of products) if (p.sku) m.set(p.sku.toLowerCase(), p);
    return m;
  }, [products]);
  const byName = React.useMemo(() => {
    const m = new Map<string, ImportProduct>();
    for (const p of products) m.set(p.name.toLowerCase(), p);
    return m;
  }, [products]);

  function ingest(text: string) {
    const parsed = parseCSV(text);
    const mapped: ParsedRow[] = parsed.map((r, i) => {
      const key = r.name.toLowerCase();
      const product = bySku.get(key) ?? byName.get(key);
      const qty = Number(r.qty);
      const price = r.price ? Number(r.price) : undefined;
      let status: ParsedRow["status"] = "ok";
      if (!product) status = "unmatched";
      else if (!Number.isFinite(qty) || qty <= 0) status = "badqty";
      return { line: i + 1, rawName: r.name, qty, price, product, status };
    });
    setRows(mapped);
    setResult(null);
    setError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  const okRows = rows.filter((r) => r.status === "ok");

  async function submit() {
    setError(null);
    setResult(null);
    if (okRows.length === 0) return setError("No valid rows to import.");
    setSaving(true);
    const res = await recordSale({
      store_id: storeId,
      lines: okRows.map((r) => ({ product_id: r.product!.id, qty: r.qty, unit_price: r.price })),
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setResult(`Imported ${okRows.length} sale line${okRows.length === 1 ? "" : "s"}.`);
    setRows([]);
    setFileName(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a POS / CSV export</CardTitle>
          <p className="text-xs text-muted-foreground">
            Columns: <span className="tnum">SKU or product name, quantity, unit price (optional)</span>. A header row is auto-detected.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-sm text-muted-foreground hover:bg-muted">
            <Upload className="h-4 w-4" />
            {fileName ?? "Choose a .csv file to import"}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Or paste rows</summary>
            <textarea
              className="mt-2 h-24 w-full rounded-md border border-input bg-card p-2 font-mono text-xs"
              placeholder={"sku,qty,unit_price\nTR-450,2,450\nIP-180,3"}
              onChange={(e) => ingest(e.target.value)}
            />
          </details>
          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {result ? (
            <p className="flex items-center gap-1.5 text-sm text-ok-foreground">
              <Check className="h-4 w-4" /> {result}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              Preview — {okRows.length} of {rows.length} rows ready
            </CardTitle>
            <Button size="sm" disabled={saving || okRows.length === 0} onClick={submit}>
              {saving ? "Importing…" : `Import ${okRows.length} line${okRows.length === 1 ? "" : "s"}`}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Matched product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.line}>
                    <TableCell className="tnum text-xs text-muted-foreground">{r.line}</TableCell>
                    <TableCell className="text-sm">{r.rawName}</TableCell>
                    <TableCell className="text-sm">{r.product?.name ?? "—"}</TableCell>
                    <TableCell className="tnum text-right">{Number.isFinite(r.qty) ? r.qty : "—"}</TableCell>
                    <TableCell className="tnum text-right">
                      {formatPHP(r.price ?? r.product?.price ?? 0)}
                    </TableCell>
                    <TableCell>
                      {r.status === "ok" ? (
                        <StatusPill tone="ok">Ready</StatusPill>
                      ) : (
                        <StatusPill tone="warn">
                          {r.status === "unmatched" ? "No match" : "Bad qty"}
                        </StatusPill>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.some((r) => r.status === "unmatched") ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" /> Unmatched rows are skipped. Match by exact SKU or product name.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
