import Link from "next/link";
import { Bell } from "lucide-react";

import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export async function NotificationBell() {
  const count = await getUnreadNotificationCount();

  return (
    <Button variant="ghost" size="icon" asChild aria-label="Notifications">
      <Link href="/notifications" className="relative">
        <Bell />
        {count > 0 && (
          <Badge className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]">
            {count}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
