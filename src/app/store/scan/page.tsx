import { requireProfile } from "@/lib/auth";
import { ScanPanel } from "@/components/scan-panel";
import { scanActions } from "@/lib/item-flow";

export default async function StoreScanPage() {
  const { profile } = await requireProfile();
  const perspective = profile.role === "admin" ? "admin" : "consignee";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Scan</h1>
        <p className="text-sm text-muted-foreground">
          Pick an action, then scan the item’s QR (or type its code). Receiving requires a valid dispatch scan first.
        </p>
      </div>
      <ScanPanel actions={scanActions(perspective)} />
    </div>
  );
}
