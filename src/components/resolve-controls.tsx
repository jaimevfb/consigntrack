"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { resolveException, resolveDispute } from "@/app/_actions/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Resolver({ onResolve }: { onResolve: (text: string) => Promise<{ ok: boolean; error?: string }> }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Resolve
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Resolution note"
        className="h-8 w-48"
      />
      <Button
        size="sm"
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await onResolve(text.trim());
          setBusy(false);
          if (!res.ok) return setErr(res.error ?? "Failed");
          router.refresh();
        }}
      >
        {busy ? "…" : "Save"}
      </Button>
      {err ? <span className="text-xs text-destructive">{err}</span> : null}
    </div>
  );
}

export function ExceptionResolve({ id }: { id: string }) {
  return <Resolver onResolve={(t) => resolveException(id, t)} />;
}

export function DisputeResolve({ id }: { id: string }) {
  return <Resolver onResolve={(t) => resolveDispute(id, t)} />;
}
