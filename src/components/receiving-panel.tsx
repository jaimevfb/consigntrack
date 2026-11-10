import Link from "next/link";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import type { AwaitingPackage } from "@/components/package-manifest-modal";
import { formatDate } from "@/lib/utils";

export type { AwaitingPackage, AwaitingLine } from "@/components/package-manifest-modal";
export interface HistoryRow { id: string; pkg_code: string; consignor_name: string; units: number; status: string; updated_at: string }

const STATUS_TONE: Record<string, "ok" | "warn" | "info" | "neutral"> = {
  DELIVERED: "ok", PARTIAL_DISPUTED: "warn", IN_TRANSIT: "info", PACKED: "neutral",
};
function statusLabel(s: string) { return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export function ReceivingPanel({ awaiting, history }: { awaiting: AwaitingPackage[]; history: HistoryRow[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Awaiting receipt</CardTitle>
          <p className="text-xs text-muted-foreground">Packages in transit to your store. Scan the package&apos;s QR to open its manifest — stock only moves once you scan and confirm.</p>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing in transit right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {awaiting.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="tnum font-semibold">{p.pkg_code}</div>
                    <div className="text-xs text-muted-foreground">{p.consignor_name} · {p.units} units</div>
                  </div>
                  <Button asChild size="sm" variant="outline"><Link href="/scan"><QrCode className="h-4 w-4" /> Scan to receive</Link></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Delivery history</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead><TableHead>Consignor</TableHead>
                  <TableHead className="text-right">Units</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="tnum font-medium"><Link href={`/packages/${h.id}`} className="text-primary hover:underline">{h.pkg_code}</Link></TableCell>
                    <TableCell>{h.consignor_name}</TableCell>
                    <TableCell className="tnum text-right">{h.units}</TableCell>
                    <TableCell><StatusPill tone={STATUS_TONE[h.status] ?? "neutral"}>{statusLabel(h.status)}</StatusPill></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(h.updated_at)}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No packages yet.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
