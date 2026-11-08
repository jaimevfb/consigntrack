import { requireProfile } from "@/lib/auth";
import { ScanPanel } from "@/components/scan-panel";
import { scanActions } from "@/lib/item-flow";

export default async function ConsignorScanPage() {
  await requireProfile();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Scan items</h1>
        <p className="text-sm text-muted-foreground">
          Scan each item&rsquo;s QR code, or enter its code manually, to mark it dispatched. Items can only be
          handed over by scanning; the store then confirms receipt by scanning the same codes.
        </p>
      </div>
      <ScanPanel actions={scanActions("consignor")} />
    </div>
  );
}
