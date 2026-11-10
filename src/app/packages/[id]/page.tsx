import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile, homeForRole } from "@/lib/auth";
import { getPackageDetail } from "@/lib/ledger-data";
import { PackageTimeline } from "@/components/package-timeline";
import { PackageQrCard } from "@/components/package-qr-card";
import { VoidPackageButton } from "@/components/void-package-button";
import { ReportLostButton } from "@/components/report-lost-button";
import { StatusPill } from "@/components/status-pill";
import { Wordmark } from "@/components/brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Package" };

const TONE: Record<string, "ok" | "warn" | "info" | "neutral"> = { DELIVERED: "ok", RECEIVED_BY_CONSIGNOR: "ok", PARTIAL_DISPUTED: "warn", LOST: "warn", IN_TRANSIT: "info", RETURN_IN_TRANSIT: "info", PACKED: "neutral", VOID: "neutral" };
function label(s: string) { return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export default async function PackageDetailPage({ params }: { params: { id: string } }) {
  const { profile } = await requireProfile();
  const pkg = await getPackageDetail(params.id);
  if (!pkg) notFound();
  const home = homeForRole(profile.role);
  const isReturn = pkg.direction === "RETURN";
  const voidable = ["PACKED", "IN_TRANSIT", "RETURN_PACKED", "RETURN_IN_TRANSIT"].includes(pkg.status);
  const owns = isReturn ? profile.store_id === pkg.consignee_id : profile.consignor_id === pkg.consignor_id;
  const canVoid = voidable && (owns || profile.role === "admin");
  const dispatched = pkg.status === "IN_TRANSIT" || pkg.status === "RETURN_IN_TRANSIT";
  const isParty = profile.consignor_id === pkg.consignor_id || profile.store_id === pkg.consignee_id || profile.role === "admin";
  const canWriteOff = dispatched && isParty;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
        <Wordmark />
        <Link href={home} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="tnum text-2xl font-bold">{pkg.pkg_code}</h1>
            <p className="text-sm text-muted-foreground">{isReturn ? "Return" : "Shipment"} · {pkg.consignor_name} {isReturn ? "←" : "→"} {pkg.store_name}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill tone={TONE[pkg.status] ?? "neutral"}>{label(pkg.status)}</StatusPill>
            {canVoid ? <VoidPackageButton packageId={pkg.id} pkgCode={pkg.pkg_code} dispatched={dispatched} /> : null}
            {canWriteOff ? <ReportLostButton packageId={pkg.id} pkgCode={pkg.pkg_code} liability={pkg.liability} /> : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
            <CardContent><PackageTimeline pkg={pkg} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Package QR</CardTitle></CardHeader>
            <CardContent><PackageQrCard code={pkg.pkg_code} token={pkg.qr_token} from={pkg.consignor_name} to={pkg.store_name} units={pkg.lines.reduce((a, l) => a + l.qty_expected, 0)} /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Manifest</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Disputed</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pkg.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="tnum text-sm text-muted-foreground">{l.sku}</TableCell>
                      <TableCell className="tnum text-right">{l.qty_expected}</TableCell>
                      <TableCell className="tnum text-right">{l.qty_received ?? "—"}</TableCell>
                      <TableCell className="tnum text-right">{l.qty_disputed > 0 ? <span className="text-warn-foreground">{l.qty_disputed}</span> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {pkg.events.length > 0 ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Event history</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {pkg.events.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-2">
                    <span className="capitalize">{e.entry_type.replace(/_/g, " ").toLowerCase()} {e.reason ? <span className="text-muted-foreground">· {e.reason}</span> : null}</span>
                    <span className="tnum text-muted-foreground">{e.qty > 0 ? `+${e.qty}` : e.qty} · {formatDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
