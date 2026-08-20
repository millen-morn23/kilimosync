"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShoppingCart, X } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#for-farmers", label: "For Farmers" },
  { href: "/#for-buyers", label: "For Buyers" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader({
  isAuthenticated = false,
  dashboardHref = "/dashboard",
  cartItemCount,
}: {
  isAuthenticated?: boolean;
  dashboardHref?: string;
  cartItemCount?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="KilimoSync home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {typeof cartItemCount === "number" && (
            <Button variant="ghost" size="icon" asChild aria-label="Cart">
              <Link href="/cart" className="relative">
                <ShoppingCart />
                {cartItemCount > 0 && (
                  <Badge className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]">
                    {cartItemCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )}
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link href={dashboardHref}>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-foreground lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-6 lg:hidden">
          <nav className="flex flex-col gap-1 pt-2" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            {typeof cartItemCount === "number" && (
              <Button variant="outline" asChild>
                <Link href="/cart" onClick={() => setOpen(false)}>
                  Cart{cartItemCount > 0 ? ` (${cartItemCount})` : ""}
                </Link>
              </Button>
            )}
            {isAuthenticated ? (
              <Button asChild>
                <Link href={dashboardHref} onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
