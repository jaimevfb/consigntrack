"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PieChart,
  Truck,
  Receipt,
  FileText,
  ShoppingCart,
  Boxes,
  RotateCcw,
  QrCode,
  ScanLine,
  AlertTriangle,
  Bell,
  Tag,
  Handshake,
  Users,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  Settings,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/app/_actions/auth";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  overview: LayoutDashboard,
  analytics: PieChart,
  deliveries: Truck,
  settlements: Receipt,
  reports: FileText,
  sell: ShoppingCart,
  inventory: Boxes,
  returns: RotateCcw,
  items: QrCode,
  scan: ScanLine,
  exceptions: AlertTriangle,
  products: Tag,
  agreements: Handshake,
  accounts: Users,
  catalog: Tag,
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || (href.split("/").length > 2 && pathname.startsWith(href));
}

function NavList({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const isActive = useActive();
  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {nav.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileMenu({ userName, roleLabel, initials }: { userName: string; roleLabel: string; initials: string }) {
  const [open, setOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div ref={ref} className="relative border-t border-border p-3">
      {open ? (
        <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-pop">
          <button onClick={() => setTheme(isDark ? "light" : "dark")} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {isDark ? "Light mode" : "Dark mode"}
          </button>
          <form action={signOut} className="border-t border-border">
            <button type="submit" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-muted">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-muted">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials || "U"}</span>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          <div className="truncate font-medium text-foreground">{userName}</div>
          <div>{roleLabel}</div>
        </div>
        <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

export function AppShell({
  role,
  scopeLabel,
  userName,
  nav,
  children,
  alertCount = 0,
  alertHref = "/",
}: {
  role: string;
  scopeLabel: string;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
  alertCount?: number;
  alertHref?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const roleLabel = role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" aria-label="ConsignTrack home">
            <Wordmark />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Workspace
          </p>
          <NavList nav={nav} />
        </div>
        <ProfileMenu userName={userName} roleLabel={roleLabel} initials={initials} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-card">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Wordmark />
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {roleLabel} workspace
              </p>
              <p className="mt-1 truncate text-sm font-medium">{scopeLabel}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Workspace
              </p>
              <NavList nav={nav} onNavigate={() => setOpen(false)} />
            </div>
            <ProfileMenu userName={userName} roleLabel={roleLabel} initials={initials} />
          </aside>
        </div>
      ) : null}

      {/* Content */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="lg:hidden">
            <Wordmark showMark />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{roleLabel} workspace</div>
              <div className="text-sm font-medium leading-tight">{scopeLabel}</div>
            </div>
            <Link
              href={alertHref}
              aria-label={alertCount === 1 ? "1 notification" : `${alertCount} notifications`}
              title={alertCount === 1 ? "1 notification" : `${alertCount} notifications`}
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" />
              {alertCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[10px] font-semibold text-warn-foreground">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
