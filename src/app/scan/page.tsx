import Link from "next/link";
import { X } from "lucide-react";
import { requireProfile, homeForRole } from "@/lib/auth";
import { ScanHub } from "@/components/scan-hub";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Scan" };

export default async function ScanPage() {
  const { profile } = await requireProfile();
  const home = homeForRole(profile.role);
  const storeId = profile.role === "store_manager" || profile.role === "store_staff" || profile.role === "admin" ? profile.store_id : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Scan</span>
          <Link href={home} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Done">
            <X className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <main className="px-4 py-6">
        <h1 className="mx-auto mb-4 max-w-xl text-center text-xl font-semibold">Scan</h1>
        <ScanHub storeId={storeId} />
      </main>
    </div>
  );
}
