import { requireProfile } from "@/lib/auth";
import { ScanPanel } from "@/components/scan-panel";
import { scanActions } from "@/lib/item-flow";

export default async function StoreScanPage() {
  const { profile } = await requireProfile();
  const perspective = profile.role === "admin" ? "admin" : "consignee";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Scan items</h1>
        <p className="text-sm text-muted-foreground">
          Select an action, then scan the item&rsquo;s QR code or enter its code manually. Receiving requires a prior dispatch scan.
        </p>
      </div>
      <ScanPanel actions={scanActions(perspective)} />
    </div>
  );
}
