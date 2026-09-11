import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PerfBar } from "@/components/stat-tile";
import { formatPHP, formatNumber } from "@/lib/utils";
import type { PerfRow } from "@/lib/data";

export function ReportTable({
  title,
  firstColumn,
  rows,
}: {
  title: string;
  firstColumn: string;
  rows: PerfRow[];
}) {
  const maxGross = Math.max(1, ...rows.map((r) => r.gross));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{firstColumn}</TableHead>
              <TableHead className="text-right">Units sold</TableHead>
              <TableHead className="w-40">Share</TableHead>
              <TableHead className="text-right">Gross</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(r.qtySold)}</TableCell>
                <TableCell>
                  <PerfBar value={r.gross} max={maxGross} />
                </TableCell>
                <TableCell className="tnum text-right">{formatPHP(r.gross)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No sales recorded yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
