"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "cn";
import { ShopifyStatusNote, ShopifyStatusProvider } from "@/components/shopify-status-note";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/stores", label: "Stores" },
  { href: "/products", label: "Products" },
  { href: "/sales", label: "Sales" },
  { href: "/invoices", label: "Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/documents", label: "Consignee Documents" },
  { href: "/server", label: "Server" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-3 text-base font-medium md:py-2.5 md:text-sm",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div>
      <p className="font-heading text-2xl leading-none text-foreground">Cotton & Clay</p>
      <p className="mt-1 text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Consignment tracker</p>
    </div>
  );
}

function SharedNote() {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      One shared tracker. Phones and shop computers see the same stock.
    </p>
  );
}

function SidebarFooter() {
  return (
    <div className="grid gap-3">
      <SharedNote />
      <ShopifyStatusNote />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find((item) => isActive(pathname, item.href));

  if (pathname === "/login") {
    return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>;
  }

  return (
    <ShopifyStatusProvider>
      <div className="min-h-screen min-w-0 overflow-x-clip">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex print:hidden">
          <Brand />
          <div className="mt-8">
            <NavLinks />
          </div>
          <div className="mt-auto border-t border-sidebar-border pt-4">
            <SidebarFooter />
          </div>
        </aside>

        <div className="min-w-0 md:pl-64 print:pl-0">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/80 bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:hidden print:hidden">
            <Button variant="outline" size="icon" className="size-10" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <div className="min-w-0">
              <p className="font-heading text-xl leading-none">Cotton & Clay</p>
              <p className="truncate text-sm text-muted-foreground">{current?.label ?? "Consignment tracker"}</p>
            </div>
          </header>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand />
              </SheetHeader>
              <div className="px-4">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-auto border-t border-border p-4">
                <SidebarFooter />
              </div>
            </SheetContent>
          </Sheet>
          <main className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-4 py-6 pb-[max(4.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-[max(1.5rem,env(safe-area-inset-bottom))] print:max-w-none print:overflow-visible print:px-4 print:py-0">{children}</main>
        </div>
        {open ? null : (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sidebar-border bg-sidebar/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden print:hidden">
            <ShopifyStatusNote />
          </div>
        )}
      </div>
    </ShopifyStatusProvider>
  );
}
