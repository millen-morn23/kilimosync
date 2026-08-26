import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data/current-user";

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "admin") redirect("/admin");
  if (user.role === "farmer") redirect("/dashboard/farmer");
  if (user.role === "delivery_partner") redirect("/dashboard/delivery-partner");
  redirect("/dashboard/buyer");
}
