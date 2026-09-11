import { Download } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getStoreReport } from "@/lib/data";
import { ReportTable } from "@/components/report-table";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

export default async function StoreReportsPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return <p className="text-sm text-muted-foreground">No store scope on this account.</p>;
  }
  const report = await getStoreReport(profile.store_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Reports</h1>
          <p className="text-sm text-muted-foreground">Performance by product and by consignor (all time).</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/reports/store?type=product">
              <Download className="h-4 w-4" /> Products CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/reports/store?type=consignor">
              <Download className="h-4 w-4" /> Consignors CSV
            </a>
          </Button>
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportTable title="By product" firstColumn="Product" rows={report.byProduct} />
        <ReportTable title="By consignor" firstColumn="Consignor" rows={report.byConsignor} />
      </div>
    </div>
  );
}
