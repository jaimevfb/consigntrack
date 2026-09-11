import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/utils";
import type { Discrepancy } from "@/lib/types";

export function AnomalyFeed({
  discrepancies,
  productNames = {},
  storeNames = {},
  consignorNames = {},
}: {
  discrepancies: Discrepancy[];
  productNames?: Record<string, string>;
  storeNames?: Record<string, string>;
  consignorNames?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warn-foreground" />
          Anomaly feed
        </CardTitle>
        <span className="tnum text-sm text-muted-foreground">{discrepancies.length}</span>
      </CardHeader>
      <CardContent>
        {discrepancies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No discrepancies. The ledger reconciles across all lines.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {discrepancies.map((d, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusPill tone="warn">
                      {d.kind === "unexplained_shrinkage" ? "Shrinkage" : "Mismatch"}
                    </StatusPill>
                    <span className="truncate text-sm font-medium">
                      {productNames[d.product_id] ?? "Product"}
                      {storeNames[d.store_id] ? ` · ${storeNames[d.store_id]}` : ""}
                      {consignorNames[d.consignor_id] ? ` · ${consignorNames[d.consignor_id]}` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{d.detail}</p>
                </div>
                <div className="tnum shrink-0 text-right text-sm">
                  <div className={d.qty < 0 ? "text-warn-foreground" : ""}>{d.qty}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(d.occurred_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
