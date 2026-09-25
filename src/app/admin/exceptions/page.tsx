import { requireProfile } from "@/lib/auth";
import { getExceptionsQueue, getDisputesQueue } from "@/lib/items-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { ExceptionResolve, DisputeResolve } from "@/components/resolve-controls";
import { formatDateTime } from "@/lib/utils";

export default async function AdminExceptionsPage() {
  await requireProfile();
  const [exceptions, disputes] = await Promise.all([getExceptionsQueue(false), getDisputesQueue()]);
  const openExc = exceptions.filter((e) => e.status === "open").length;
  const openDisp = disputes.filter((d) => d.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Exceptions &amp; disputes</h1>
        <p className="text-sm text-muted-foreground">
          Custody anomalies and disputes across the platform. {openExc} open exception{openExc === 1 ? "" : "s"},{" "}
          {openDisp} open dispute{openDisp === 1 ? "" : "s"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custody exceptions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell className="text-sm">
                    <span className="tnum">{e.items?.code ?? "—"}</span>
                    <div className="text-xs text-muted-foreground">{e.items?.description}</div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{e.kind.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.detail}</TableCell>
                  <TableCell>
                    <StatusPill tone={e.status === "open" ? "warn" : "ok"}>{e.status}</StatusPill>
                  </TableCell>
                  <TableCell className="text-right">
                    {e.status === "open" ? <ExceptionResolve id={e.id} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {exceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No exceptions. Custody is clean.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Raised by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(d.created_at)}</TableCell>
                  <TableCell className="tnum text-sm">{d.items?.code ?? "—"}</TableCell>
                  <TableCell className="text-sm">{d.subject}</TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">{d.raised_role?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell>
                    <StatusPill tone={d.status === "open" ? "warn" : "ok"}>{d.status}</StatusPill>
                  </TableCell>
                  <TableCell className="text-right">
                    {d.status === "open" ? <DisputeResolve id={d.id} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No disputes.
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
