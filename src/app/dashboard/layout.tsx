import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentUser } from "@/lib/data/current-user";
import { signOut } from "@/lib/actions/auth";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" aria-label="KilimoSync dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Badge variant="outline" className="capitalize">
              {user.role}
            </Badge>
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
