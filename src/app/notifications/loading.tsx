import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
