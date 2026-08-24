import { SiteHeaderContainer } from "@/components/marketing/site-header-container";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <>
      <SiteHeaderContainer />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-8 h-40 w-full rounded-xl" />
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      </main>
      <SiteFooter />
    </>
  );
}
