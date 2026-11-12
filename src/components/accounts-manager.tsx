"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Store as StoreIcon, Check } from "lucide-react";
import { createConsignorAccount, issueStoreAccount } from "@/app/_actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";

export interface ConsignorOption {
  id: string;
  name: string;
}
export interface AccountRow {
  kind: "consignor" | "store";
  name: string;
  email: string | null;
  connectedTo: string | null;
  connections: number;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function AccountsManager({
  consignors,
  rows,
}: {
  consignors: ConsignorOption[];
  rows: AccountRow[];
}) {
  const [tab, setTab] = React.useState<"consignor" | "store">("consignor");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setTab("consignor")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "consignor" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <UserPlus className="h-4 w-4" /> Consignor
        </button>
        <button
          type="button"
          onClick={() => setTab("store")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "store" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <StoreIcon className="h-4 w-4" /> Store (consignee)
        </button>
      </div>

      <div className="max-w-2xl">
        {tab === "consignor" ? <ConsignorForm /> : <StoreForm consignors={consignors} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issued accounts</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every account is provisioned here. There is no self-serve sign-up.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sign-in email</TableHead>
                <TableHead>Connection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <StatusPill tone={r.kind === "consignor" ? "ok" : "neutral"}>
                      {r.kind === "consignor" ? "Consignor" : "Consignee"}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {r.kind === "consignor"
                      ? `${r.connections} store${r.connections === 1 ? "" : "s"} connected`
                      : r.connectedTo
                        ? `→ ${r.connectedTo}`
                        : "Not connected"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No accounts issued yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsignorForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [org, setOrg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setBusy(true);
    const res = await createConsignorAccount({ email, password, full_name: fullName, org_name: org });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOk(true);
    setEmail("");
    setPassword("");
    setFullName("");
    setOrg("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-primary" /> Issue consignor account
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Creates the product owner (consignor) and their sign-in.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Field id="c-org" label="Business / brand name">
            <Input id="c-org" required value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. Maria's Weaves" />
          </Field>
          <Field id="c-name" label="Contact name">
            <Input id="c-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field id="c-email" label="Sign-in email">
            <Input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="c-pass" label="Temporary password">
            <Input id="c-pass" type="text" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
          </Field>
          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {ok ? (
            <p className="flex items-center gap-1.5 rounded-md bg-ok/40 px-3 py-2 text-sm text-ok-foreground">
              <Check className="h-4 w-4" /> Consignor account issued.
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Issuing…" : "Issue consignor account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StoreForm({ consignors }: { consignors: ConsignorOption[] }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [storeName, setStoreName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [consignorId, setConsignorId] = React.useState(consignors[0]?.id ?? "");
  const [pct, setPct] = React.useState("15");
  const [cad, setCad] = React.useState("monthly");
  const [period, setPeriod] = React.useState("60");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!consignorId) return setError("Create a consignor first, then connect the store to it.");
    setBusy(true);
    const res = await issueStoreAccount({
      email,
      password,
      full_name: fullName,
      store_name: storeName,
      location,
      consignor_id: consignorId,
      commission_pct: Number(pct),
      cadence: cad,
      consignment_period_days: Number(period),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOk(true);
    setEmail("");
    setPassword("");
    setFullName("");
    setStoreName("");
    setLocation("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StoreIcon className="h-4 w-4 text-primary" /> Issue consignee (store) account
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Creates the store sign-in, connects it to a consignor, and opens the agreement — so the
          consignor&rsquo;s products appear on the store&rsquo;s end immediately.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Field id="s-consignor" label="Connected consignor">
            <Select value={consignorId} onValueChange={setConsignorId}>
              <SelectTrigger id="s-consignor">
                <SelectValue placeholder={consignors.length ? "Select consignor" : "No consignors yet"} />
              </SelectTrigger>
              <SelectContent>
                {consignors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="s-store" label="Store name">
              <Input id="s-store" required value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Kultura — SM Aura" />
            </Field>
            <Field id="s-loc" label="Location">
              <Input id="s-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Taguig" />
            </Field>
          </div>
          <Field id="s-name" label="Manager name">
            <Input id="s-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="s-email" label="Sign-in email">
              <Input id="s-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field id="s-pass" label="Temporary password">
              <Input id="s-pass" type="text" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 chars" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field id="s-pct" label="Commission %">
              <Input id="s-pct" type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
            </Field>
            <Field id="s-cad" label="Cadence">
              <Select value={cad} onValueChange={setCad}>
                <SelectTrigger id="s-cad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="s-period" label="Period (days)">
              <Input id="s-period" type="number" min={1} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </Field>
          </div>
          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {ok ? (
            <p className="flex items-center gap-1.5 rounded-md bg-ok/40 px-3 py-2 text-sm text-ok-foreground">
              <Check className="h-4 w-4" /> Store account issued and connected.
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !consignorId} className="w-full">
            {busy ? "Issuing…" : "Issue store account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
