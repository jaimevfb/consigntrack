import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Generic dashboard placeholder shown instantly during navigation. */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-[150px] w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mx-auto mt-4 h-36 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
