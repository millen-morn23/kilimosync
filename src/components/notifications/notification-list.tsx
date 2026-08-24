"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationData } from "@/lib/data/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
};

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.read_at);

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div>
      {hasUnread && (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" disabled={isPending} onClick={markAll}>
            Mark all as read
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={n.read_at ? "" : "border-primary/30 bg-primary/5"}
          >
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div>
                {n.data?.order_id ? (
                  <Link href={`/orders/${n.data.order_id}`} className="font-medium text-foreground hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium text-foreground">{n.title}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("en-KE")}
                </p>
              </div>
              {!n.read_at && (
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => markOne(n.id)}>
                  Mark read
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
