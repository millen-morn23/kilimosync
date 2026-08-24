import Link from "next/link";

import type { Category } from "@/lib/data/categories";
import { getCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function CategoryChips({
  categories,
  counts,
  activeCategoryId,
}: {
  categories: Category[];
  counts: Record<string, number>;
  activeCategoryId?: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Link
        href="/marketplace"
        className={cn(
          "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          !activeCategoryId
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-muted"
        )}
      >
        All categories
      </Link>
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.icon);
        const isActive = category.id === activeCategoryId;
        const count = counts[category.id] ?? 0;
        return (
          <Link
            key={category.id}
            href={`/marketplace?category=${category.id}`}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            {category.name}
            <span className={cn("text-xs", isActive ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
