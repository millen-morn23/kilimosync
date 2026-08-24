import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
  itemLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  itemLabel: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    else params.delete("page");
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg border border-border text-sm",
            page <= 1
              ? "pointer-events-none opacity-40"
              : "text-foreground hover:bg-muted"
          )}
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only">Previous page</span>
        </Link>
        <span className="px-2 text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={page >= totalPages}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg border border-border text-sm",
            page >= totalPages
              ? "pointer-events-none opacity-40"
              : "text-foreground hover:bg-muted"
          )}
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">Next page</span>
        </Link>
      </div>
    </nav>
  );
}
