import { getCurrentUser } from "@/lib/data/current-user";
import { getCart } from "@/lib/data/cart";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { SiteHeader } from "@/components/marketing/site-header";

export async function SiteHeaderContainer() {
  const user = await getCurrentUser();

  const cartItemCount =
    user?.role === "buyer" ? (await getCart()).lines.length : undefined;
  const unreadNotificationCount = user ? await getUnreadNotificationCount() : undefined;

  const dashboardHref =
    user?.role === "admin"
      ? "/admin"
      : user?.role === "farmer"
        ? "/dashboard/farmer"
        : user?.role === "delivery_partner"
          ? "/dashboard/delivery-partner"
          : "/dashboard/buyer";

  return (
    <SiteHeader
      isAuthenticated={Boolean(user)}
      dashboardHref={dashboardHref}
      cartItemCount={cartItemCount}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}
