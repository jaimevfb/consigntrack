import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLink } from "@/components/nav-link";
import { signOut } from "@/app/_actions/auth";
import { Button } from "@/components/ui/button";

export interface NavItem {
  href: string;
  label: string;
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
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-serif text-lg font-semibold text-primary">
              ConsignTrack
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{userName}</div>
              <div className="text-xs text-muted-foreground">{scopeLabel}</div>
            </div>
            <ThemeToggle />
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="container flex items-center gap-1 overflow-x-auto pb-2 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
