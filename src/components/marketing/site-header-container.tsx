import { getCurrentUser } from "@/lib/data/current-user";
import { getCart } from "@/lib/data/cart";
import { SiteHeader } from "@/components/marketing/site-header";

export async function SiteHeaderContainer() {
  const user = await getCurrentUser();

  const cartItemCount =
    user?.role === "buyer" ? (await getCart()).lines.length : undefined;

  const dashboardHref =
    user?.role === "admin" ? "/admin" : user?.role === "farmer" ? "/dashboard/farmer" : "/dashboard/buyer";

  return (
    <SiteHeader
      isAuthenticated={Boolean(user)}
      dashboardHref={dashboardHref}
      cartItemCount={cartItemCount}
    />
  );
}
