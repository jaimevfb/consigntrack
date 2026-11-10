import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ScanLine, Receipt, Boxes } from "lucide-react";
import { getSessionProfile, homeForRole } from "@/lib/auth";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "ConsignTrack — consignment that reconciles itself" };

export default async function RootPage() {
  const session = await getSessionProfile();
  if (session) redirect(homeForRole(session.profile.role));
  return <Landing />;
}

function Landing() {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#0F172A]">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Wordmark inverted className="text-white [&_span]:text-white" />
          <div className="flex items-center gap-7 sm:gap-10">
            <Link href="#how" className="hidden text-sm font-medium text-white/80 hover:text-white sm:block">How it works</Link>
            <Link href="#features" className="hidden text-sm font-medium text-white/80 hover:text-white sm:block">Features</Link>
            <Link href="/login" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-white/90">Log in</Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#0B1020] via-[#2743C9] to-[#F7F8FC]" />
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "26px 26px" }} />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-40 text-center">
          <h1 className="font-serif text-4xl font-semibold leading-[1.08] text-white sm:text-5xl md:text-6xl">
            Settlements that reconcile<br className="hidden sm:block" /> themselves, the moment a sale lands.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
            Track every unit, sale, return, and payout across your partner stores — from one shared, auditable ledger.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] shadow-lg transition-colors hover:bg-white/90">Log in <ArrowRight className="h-4 w-4" /></Link>
            <Link href="#how" className="rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">See how it works</Link>
          </div>

          {/* Hero product mock */}
          <div className="relative mx-auto mt-16 max-w-3xl rounded-2xl border border-[#E6E8F0] bg-white p-5 text-left shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-[#64748B]">Stock across stores</div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#059669]"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> Live</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-xs text-[#94A3B8]">Network value</div>
                <div className="tnum text-3xl font-bold sm:text-4xl">₱942,090<span className="text-[#94A3B8]">.00</span></div>
              </div>
              <div className="tnum text-xs font-medium text-[#059669]">+₱48,020 sold this month</div>
            </div>
            <div className="mt-4 flex gap-1.5">
              <div className="h-2 rounded-full bg-[#2743C9]" style={{ width: "62%" }} />
              <div className="h-2 rounded-full bg-[#3B82F6]" style={{ width: "18%" }} />
              <div className="h-2 rounded-full bg-[#60A5FA]" style={{ width: "12%" }} />
              <div className="h-2 flex-1 rounded-full bg-[#DBEAFE]" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Warehouse", "₱893,800", "#2743C9"],
                ["At stores", "₱49,290", "#3B82F6"],
                ["Settled", "₱40,817", "#60A5FA"],
                ["In transit", "22 units", "#94A3B8"],
              ].map(([label, val, dot]) => (
                <div key={label} className="rounded-xl border border-[#EEF0F6] p-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#64748B]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: dot as string }} /> {label}</div>
                  <div className="tnum mt-1 text-sm font-semibold">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Set the terms once */}
      <section id="how" className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Set the terms once.<br />Every settlement follows them.</h2>
        <p className="mx-auto mt-3 max-w-lg text-[#64748B]">Agree commission and liability per store. ConsignTrack applies it the second a sale is recorded.</p>

        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#E6E8F0] bg-white p-6 text-left shadow-xl">
          <div className="text-xs text-[#94A3B8]">Sale recorded · Hand-dyed silk scarf</div>
          <div className="tnum mt-1 text-3xl font-bold">₱1,800<span className="text-[#94A3B8]">.00</span></div>
          <div className="mt-4 flex gap-1.5">
            <div className="h-2.5 rounded-full bg-[#2743C9]" style={{ width: "85%" }} />
            <div className="h-2.5 flex-1 rounded-full bg-[#CBD5E1]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#EEF0F6] p-3">
              <div className="flex items-center justify-between text-xs text-[#64748B]"><span>Consignor net</span><span className="tnum">85%</span></div>
              <div className="tnum mt-1 text-lg font-semibold">₱1,530.00</div>
            </div>
            <div className="rounded-xl border border-[#EEF0F6] p-3">
              <div className="flex items-center justify-between text-xs text-[#64748B]"><span>Store commission</span><span className="tnum">15%</span></div>
              <div className="tnum mt-1 text-lg font-semibold">₱270.00</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [Boxes, "One shared ledger", "Consignors and stores read the same stock, sales, and balances — no more reconciling spreadsheets."],
            [ScanLine, "Scan to track custody", "A unique QR per package moves stock through dispatch, receiving, and returns — only on a real scan."],
            [Receipt, "Settlements on autopilot", "Commission and payouts compute straight from recorded sales, with an auditable statement every period."],
          ].map(([Icon, title, body]) => {
            const I = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={title as string} className="rounded-2xl border border-[#E6E8F0] bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#2743C9]"><I className="h-5 w-5" /></span>
                <h3 className="mt-4 text-base font-semibold">{title as string}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[#64748B]">{body as string}</p>
              </div>
            );
          })}
        </div>

        {/* CTA band */}
        <div className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-[#2743C9] to-[#4F46E5] px-8 py-14 text-center text-white">
          <div aria-hidden className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <h2 className="relative font-serif text-3xl font-semibold sm:text-4xl">One record. Every partner. In sync.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/80">Accounts are issued by your administrator — sign in to pick up where your business left off.</p>
          <Link href="/login" className="relative mt-7 inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-white/90">Log in <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E6E8F0] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <Wordmark />
          <p className="text-xs text-[#94A3B8]">© {year} ConsignTrack · Made for independent makers &amp; retailers in the Philippines.</p>
        </div>
      </footer>
    </div>
  );
}
