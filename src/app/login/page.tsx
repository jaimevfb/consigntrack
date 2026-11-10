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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      {/* colourful aurora backdrop */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#4F46E5] via-[#3B82F6] to-[#06B6D4]" />
      <div aria-hidden className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[#A855F7]/50 blur-3xl" />
      <div aria-hidden className="absolute right-[-12%] top-[15%] h-[30rem] w-[30rem] rounded-full bg-[#22D3EE]/40 blur-3xl" />
      <div aria-hidden className="absolute bottom-[-18%] left-[28%] h-[26rem] w-[26rem] rounded-full bg-[#6366F1]/50 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)", backgroundSize: "26px 26px" }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Wordmark inverted className="text-white [&_span]:text-white" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/20 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl">
          <div aria-hidden className="h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#22D3EE] to-[#A855F7]" />
          <div className="p-6 sm:p-7">
            <LoginForm />
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-white/75">Made for independent makers &amp; retailers.</p>
      </div>
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
