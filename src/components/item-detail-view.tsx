import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifecycleStepper, CustodyTimeline, ItemStatusPill } from "@/components/item-lifecycle";
import { QrLabel } from "@/components/qr-label";
import { ItemActions } from "@/components/item-actions";
import { StatusPill } from "@/components/status-pill";
import { formatPHP, formatDate } from "@/lib/utils";
import type { ItemDetail } from "@/lib/items-data";

export function ItemDetailView({
  detail,
  actions,
  canDispute,
  backHref,
  showQr,
}: {
  detail: ItemDetail;
  actions: string[];
  canDispute: boolean;
  backHref: string;
  showQr: boolean;
}) {
  const { item, events, disputes, exceptions } = detail;
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" /> Back to items
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">{item.description}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="tnum">{item.code}</span>
              <span>·</span>
              <span>{item.consignors?.name}</span>
              <span>→</span>
              <span>{item.stores?.name}</span>
            </div>
          </div>
          <div className="text-right">
            <ItemStatusPill status={item.status} />
            <div className="tnum mt-1 text-lg font-semibold">
              {formatPHP(item.sale_price ?? item.asking_price)}
            </div>
            <div className="text-xs text-muted-foreground">{item.sale_price ? "sold" : "asking"}</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chain of custody</CardTitle>
        </CardHeader>
        <CardContent>
          <LifecycleStepper status={item.status} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Proof of custody</CardTitle>
            <p className="text-xs text-muted-foreground">Every scan, append-only. This is the audit trail.</p>
          </CardHeader>
          <CardContent>
            <CustodyTimeline events={events} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          {actions.length > 0 || canDispute ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ItemActions token={item.qr_token} itemId={item.id} actions={actions} canDispute={canDispute} />
              </CardContent>
            </Card>
          ) : null}

          {showQr ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QR label</CardTitle>
              </CardHeader>
              <CardContent>
                <QrLabel token={item.qr_token} code={item.code} description={item.description} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Category" value={item.category ?? "—"} />
              <Row label="Condition" value={item.condition ?? "—"} />
              <Row label="Holder" value={<span className="capitalize">{item.current_holder}</span>} />
              <Row label="Created" value={formatDate(item.created_at)} />
              {item.sold_at ? <Row label="Sold" value={formatDate(item.sold_at)} /> : null}
              {item.buyer_ref ? <Row label="Buyer" value={item.buyer_ref} /> : null}
            </CardContent>
          </Card>

          {exceptions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exceptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {exceptions.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{e.detail ?? e.kind}</span>
                    <StatusPill tone={e.status === "open" ? "warn" : "ok"}>{e.status}</StatusPill>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {disputes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Disputes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {disputes.map((d) => (
                  <div key={d.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{d.subject}</span>
                      <StatusPill tone={d.status === "open" ? "warn" : "ok"}>{d.status}</StatusPill>
                    </div>
                    {d.resolution ? <p className="text-xs text-muted-foreground">{d.resolution}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
