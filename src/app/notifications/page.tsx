import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { getCurrentUser } from "@/lib/data/current-user";
import { getNotifications } from "@/lib/data/notifications";
import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { NotificationList } from "@/components/notifications/notification-list";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/notifications");

  const notifications = await getNotifications();

  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>

        {notifications.length === 0 ? (
          <Card className="mt-8 items-center gap-3 py-16 text-center">
            <Bell className="size-10 text-primary" />
            <p className="max-w-sm text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </Card>
        ) : (
          <div className="mt-6">
            <NotificationList notifications={notifications} />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
