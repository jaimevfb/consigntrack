import Link from "next/link";
import { Check, Circle, ArrowRight, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface OnboardingStep { label: string; hint: string; href: string; done: boolean }

/** First-run guide — shown until the full cycle has been exercised once. */
export function OnboardingChecklist({ steps, title = "Get set up", subtitle = "Four steps to your first settlement." }: { steps: OnboardingStep[]; title?: string; subtitle?: string }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/[0.04]">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary"><Rocket className="h-4 w-4" /></span>
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <span className="tnum text-xs text-muted-foreground">{done}/{steps.length}</span>
          </div>
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {steps.map((s, i) => {
            const isNext = s === next;
            return (
              <li key={i}>
                <Link href={s.href} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${s.done ? "border-border bg-card" : isNext ? "border-primary/40 bg-card hover:bg-primary/[0.06]" : "border-border bg-card hover:bg-muted/50"}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-ok text-ok-foreground" : "border border-border text-muted-foreground"}`}>
                    {s.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.label}</div>
                    {!s.done ? <div className="truncate text-xs text-muted-foreground">{s.hint}</div> : null}
                  </div>
                  {!s.done ? <ArrowRight className={`h-4 w-4 shrink-0 ${isNext ? "text-primary" : "text-muted-foreground"}`} /> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
