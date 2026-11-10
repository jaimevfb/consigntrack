"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/brand";

export default function AuthPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#3B82F6] via-[#4356E0] to-[#4F46E5]" />
        <div aria-hidden className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          <Wordmark inverted className="text-white [&_span]:text-white" />
        </div>
        <div className="relative z-10">
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] xl:text-6xl">
            Consignment,<br />managed with clarity.
          </h1>
          <p className="mt-5 max-w-sm text-base text-white/75">
            One shared record for consignors and stores — stock, sales, and settlements.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/60">Made for independent makers &amp; retailers.</p>
      </section>

      {/* Sign-in */}
      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Wordmark /></div>
          <LoginForm />
        </div>
      </section>
    </main>
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
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="text-sm text-muted-foreground">Welcome back to ConsignTrack.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-email">Work email</Label>
        <Input id="l-email" type="email" autoComplete="email" placeholder="you@business.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-password">Password</Label>
        <Input id="l-password" type="password" autoComplete="current-password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" /></>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Accounts are issued by your administrator.</p>
    </form>
  );
}
