"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];
const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DISPUTED",
];

type Category = { id: string; name: string };

export function AnalyticsFilters({
  categories,
  counties,
  defaultValues,
}: {
  categories: Category[];
  counties: readonly string[];
  defaultValues: { period: string; county: string; category: string; status: string };
}) {
  const router = useRouter();

  function apply(next: Partial<typeof defaultValues>) {
    const merged = { ...defaultValues, ...next };
    const params = new URLSearchParams();
    if (merged.period && merged.period !== "30d") params.set("period", merged.period);
    if (merged.county) params.set("county", merged.county);
    if (merged.category) params.set("category", merged.category);
    if (merged.status) params.set("status", merged.status);
    router.push(`/admin/analytics${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-end sm:gap-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Period</label>
        <Select value={defaultValues.period} onValueChange={(v) => apply({ period: v })}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">County</label>
        <Select
          value={defaultValues.county || ALL}
          onValueChange={(v) => apply({ county: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All counties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All counties</SelectItem>
            {counties.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Category</label>
        <Select
          value={defaultValues.category || ALL}
          onValueChange={(v) => apply({ category: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Order status</label>
        <Select
          value={defaultValues.status || ALL}
          onValueChange={(v) => apply({ status: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
