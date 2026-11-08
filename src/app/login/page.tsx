"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Store, Package, Check, ShieldCheck, LineChart, Layers, ArrowRight } from "lucide-react";
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
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        <Wordmark inverted className="text-primary-foreground [&_span]:text-primary-foreground" />
        <div className="relative z-10 space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/90">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            Consignment operations platform
          </div>
          <h1 className="max-w-lg font-serif text-4xl font-semibold leading-tight xl:text-5xl">
            Consignment, managed with clarity.
          </h1>
          <p className="max-w-lg text-base leading-7 text-primary-foreground/80">
            Keep consignors and stores aligned with a shared record of inventory, sales, returns,
            and settlement activity.
          </p>
          <ul className="space-y-4 pt-1 text-sm">
            {[
              [Layers, "A consistent record across every business relationship"],
              [LineChart, "Clear reporting for sales and settlements"],
              [ShieldCheck, "Role-based access and traceable activity"],
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
          Designed for independent retailers and product makers in the Philippines.
        </p>
      </section>

      {/* Auth card */}
      <section className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
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
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
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
    if (error) return setError("We couldn’t sign you in. Check your email and password, then try again.");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-5 space-y-1">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to continue to your workspace.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-email">Work email</Label>
        <Input id="l-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-password">Password</Label>
        <Input id="l-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
        {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
      </Button>
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
    if (password.length < 6) return setError("Use a password with at least 6 characters.");
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
      return setError("We couldn’t create your account. Check your details or contact your administrator.");
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInErr) return setError("Your account was created, but we couldn’t sign you in. Please try signing in again.");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-5 space-y-1">
        <h2 className="text-xl font-semibold">Create your workspace</h2>
        <p className="text-sm text-muted-foreground">Set up an account to manage your consignment activity.</p>
      </div>
      <div className="space-y-1.5">
        <Label>I represent</Label>
        <div className="grid grid-cols-2 gap-2">
          <TypeCard active={type === "consignor"} onClick={() => setType("consignor")} icon={Package} title="Product business" sub="I supply products" />
          <TypeCard active={type === "store_manager"} onClick={() => setType("store_manager")} icon={Store} title="Retail store" sub="I sell consigned products" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-org">{type === "consignor" ? "Business / brand name" : "Store name"}</Label>
        <Input id="s-org" required value={org} onChange={(e) => setOrg(e.target.value)} placeholder={type === "consignor" ? "e.g. Maria's Weaves" : "e.g. Kultura — SM Aura"} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Full name</Label>
        <Input id="s-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-email">Work email</Label>
        <Input id="s-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-password">Create password</Label>
        <Input id="s-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Store staff and administrator accounts are set up by an authorized manager.
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
