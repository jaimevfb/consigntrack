import { requireProfile } from "@/lib/auth";
import { ScanPanel } from "@/components/scan-panel";
import { scanActions } from "@/lib/item-flow";

export default async function ConsignorScanPage() {
  await requireProfile();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Scan to dispatch</h1>
        <p className="text-sm text-muted-foreground">
          Scan each item’s QR (or type its code) to mark it dispatched. This is the only way to hand
          goods over — the store then confirms receipt by scanning the same codes.
        </p>
      </div>
      <ScanPanel actions={scanActions("consignor")} />
    </div>
  );
}
