"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  confirmDelivery,
  markSettlementPaid,
  confirmPaymentReceived,
  type ActionResult,
} from "@/app/_actions/ledger";

type Kind = "confirmDelivery" | "markPaid" | "confirmReceived";

const actions: Record<Kind, (id: string) => Promise<ActionResult>> = {
  confirmDelivery,
  markPaid: markSettlementPaid,
  confirmReceived: confirmPaymentReceived,
};

export function RowActionButton({
  kind,
  id,
  label,
  pendingLabel,
  variant = "default",
  size = "sm",
}: {
  kind: Kind;
  id: string;
  label: string;
  pendingLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    const res = await actions[kind](id);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button variant={variant} size={size} onClick={onClick} disabled={pending}>
        {pending ? pendingLabel ?? "Working…" : label}
      </Button>
      {error ? <span className="max-w-52 text-right text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
