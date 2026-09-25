"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Store, Package, Check, ShieldCheck, LineChart, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

export default function AuthPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / value panel */}
      <section className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Wordmark inverted className="text-primary-foreground [&_span]:text-primary-foreground" />
        <div className="space-y-6">
          <h1 className="max-w-md font-serif text-4xl font-semibold leading-tight">
            One shared ledger for consignors and stores.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Record deliveries, sales, returns and settlements once — both sides read the same
            numbers, and discrepancies surface the moment they happen.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              [Layers, "Multi-store, multi-consignor shared ledger"],
              [LineChart, "Live analytics: sales trends, settlements, performance"],
              [ShieldCheck, "Role-based access with an append-only audit trail"],
            ].map(([Icon, text], i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-foreground/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text as string}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/70">
          Built for Philippine MSME retail · Data Privacy Act aligned
        </p>
      </section>

      {/* Auth card */}
      <section className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Wordmark />
          </div>
          <AuthCard />
        </div>
      </section>
    </main>
  );
}

function AuthCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="login">
          <TabsList className="mb-5 grid w-full grid-cols-2">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm />
          </TabsContent>
          <TabsContent value="signup">
            <SignupForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="l-email">Email</Label>
        <Input id="l-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-password">Password</Label>
        <Input id="l-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Log in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Demo: <span className="tnum">maria@consigntrack.test</span> / consignor123
      </p>
    </form>
  );
}

type AccountType = "consignor" | "store_manager";

function SignupForm() {
  const router = useRouter();
  const [type, setType] = React.useState<AccountType>("consignor");
  const [org, setOrg] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    const supabase = createClient();

    // Provision the account directly (email-free), then sign in.
    const { error: signUpErr } = await supabase.rpc("signup_account", {
      p_email: email,
      p_password: password,
      p_role: type,
      p_org_name: org,
      p_full_name: fullName,
    });
    if (signUpErr) {
      setLoading(false);
      return setError(signUpErr.message.replace(/^.*?:\s*/, ""));
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInErr) return setError(signInErr.message);
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>I am a…</Label>
        <div className="grid grid-cols-2 gap-2">
          <TypeCard active={type === "consignor"} onClick={() => setType("consignor")} icon={Package} title="Consignor" sub="I supply goods" />
          <TypeCard active={type === "store_manager"} onClick={() => setType("store_manager")} icon={Store} title="Store" sub="I sell goods" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-org">{type === "consignor" ? "Business / brand name" : "Store name"}</Label>
        <Input id="s-org" required value={org} onChange={(e) => setOrg(e.target.value)} placeholder={type === "consignor" ? "e.g. Maria's Weaves" : "e.g. Kultura — SM Aura"} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Your name</Label>
        <Input id="s-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-email">Email</Label>
        <Input id="s-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-password">Password</Label>
        <Input id="s-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Store staff &amp; admin accounts are provisioned by a store manager.
      </p>
    </form>
  );
}

function TypeCard({
  active,
  onClick,
  icon: Icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-accent" : "border-border hover:bg-muted",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{title}</span>
        {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}
