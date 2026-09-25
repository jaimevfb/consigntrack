"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Check, AlertTriangle, ScanLine } from "lucide-react";
import { itemScan } from "@/app/_actions/items";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  dispatch: "Dispatch",
  deliver: "Delivered",
  receive: "Receive",
  list: "List",
  sell: "Sell",
  return: "Return",
  flag_damaged: "Damaged",
  flag_lost: "Lost",
};

export function ScanPanel({ actions }: { actions: string[] }) {
  const router = useRouter();
  const [event, setEvent] = React.useState(actions[0] ?? "receive");
  const [manual, setManual] = React.useState("");
  const [camOn, setCamOn] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; exception?: boolean; text: string; code?: string } | null>(null);
  const scannerRef = React.useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const stopCam = React.useCallback(async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }, []);

  React.useEffect(() => () => void stopCam(), [stopCam]);

  async function resolveToken(input: string): Promise<string | null> {
    const s = input.trim();
    if (s.startsWith("CT1.")) return s;
    if (/^CT-/i.test(s)) {
      const supabase = createClient();
      const { data } = await supabase.from("items").select("qr_token").eq("code", s.toUpperCase()).maybeSingle();
      return (data as { qr_token?: string } | null)?.qr_token ?? null;
    }
    return null;
  }

  async function apply(token: string) {
    setBusy(true);
    const res = await itemScan({ token, event_type: event });
    setBusy(false);
    if (!res.ok) return setResult({ ok: false, text: res.error });
    setResult({ ok: !res.exception, exception: res.exception, text: res.message });
    router.refresh();
  }

  async function onManual() {
    setResult(null);
    const token = await resolveToken(manual);
    if (!token) return setResult({ ok: false, text: "Enter a valid item code (CT-XXXXXX) or scan its QR." });
    await apply(token);
    setManual("");
  }

  async function toggleCam() {
    if (camOn) {
      await stopCam();
      setCamOn(false);
      return;
    }
    setResult(null);
    setCamOn(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        async (decoded: string) => {
          await stopCam();
          setCamOn(false);
          await apply(decoded);
        },
        () => {},
      );
    } catch {
      setCamOn(false);
      setResult({ ok: false, text: "Camera unavailable — enter the item code manually below." });
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* action selector */}
      <div>
        <Label>Action</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setEvent(a)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                event === a ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >
              {LABELS[a] ?? a}
            </button>
          ))}
        </div>
      </div>

      {/* camera */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div id="qr-reader" className={cn("aspect-square w-full bg-muted", !camOn && "hidden")} />
        {!camOn ? (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 bg-muted/50 text-muted-foreground">
            <ScanLine className="h-10 w-10" />
            <p className="text-sm">Scan an item’s QR to {LABELS[event]?.toLowerCase()}</p>
          </div>
        ) : null}
        <div className="border-t border-border p-3">
          <Button variant="outline" className="w-full" onClick={toggleCam}>
            {camOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {camOn ? "Stop camera" : "Scan with camera"}
          </Button>
        </div>
      </div>

      {/* manual */}
      <div className="space-y-1.5">
        <Label htmlFor="man">Or enter the item code</Label>
        <div className="flex gap-2">
          <Input id="man" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="CT-A1B2C3" className="tnum uppercase" />
          <Button onClick={onManual} disabled={busy || !manual.trim()}>
            {busy ? "…" : "Apply"}
          </Button>
        </div>
      </div>

      {result ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            result.ok
              ? "border-ok-foreground/30 bg-ok/50 text-ok-foreground"
              : "border-warn-foreground/30 bg-warn/50 text-warn-foreground",
          )}
        >
          {result.ok ? <Check className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <div>
            <div className="font-medium">{result.ok ? "Scan recorded" : result.exception ? "Flagged as exception" : "Rejected"}</div>
            <div>{result.text}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
