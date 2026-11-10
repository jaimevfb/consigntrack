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
      {/* brand blue gradient — matches the main site */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#141C57] via-[#2743C9] to-[#4F46E5]" />
      <div aria-hidden className="absolute -top-32 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#60A5FA]/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 right-[-12%] h-[30rem] w-[30rem] rounded-full bg-[#4F46E5]/40 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)", backgroundSize: "26px 26px" }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Wordmark showMark={false} inverted className="text-2xl text-white [&_span]:text-white" />
        </div>
        <div className="force-light overflow-hidden rounded-2xl border border-white/15 bg-card shadow-2xl ring-1 ring-black/5">
          <div className="p-7 sm:p-8">
            <LoginForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/70">© {new Date().getFullYear()} ConsignTrack</p>
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
