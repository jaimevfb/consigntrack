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
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <nav className="space-y-1">
      {nav.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
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

export function AppShell({
  role,
  scopeLabel,
  userName,
  nav,
  children,
}: {
  role: string;
  scopeLabel: string;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const roleLabel = role.replace("_", " ");

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/" aria-label="ConsignTrack home">
            <Wordmark />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList nav={nav} />
        </div>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{userName}</div>
          <div className="capitalize">{roleLabel}</div>
        </div>
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
            <div className="flex-1 overflow-y-auto p-3">
              <NavList nav={nav} onNavigate={() => setOpen(false)} />
            </div>
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
              <div className="text-sm font-medium leading-tight">{scopeLabel}</div>
              <div className="text-xs capitalize text-muted-foreground">{roleLabel}</div>
            </div>
            <ThemeToggle />
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
