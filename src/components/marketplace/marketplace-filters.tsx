"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = { id: string; name: string };

const ALL = "__all__";

export function MarketplaceFiltersBar({
  categories,
  counties,
  defaultValues,
}: {
  categories: Category[];
  counties: readonly string[];
  defaultValues: {
    q: string;
    category: string;
    county: string;
    minPrice: string;
    maxPrice: string;
    sort: string;
  };
}) {
  const router = useRouter();
  const [values, setValues] = useState(defaultValues);

  function apply(next: Partial<typeof values>) {
    const merged = { ...values, ...next };
    setValues(merged);

    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.county) params.set("county", merged.county);
    if (merged.minPrice) params.set("minPrice", merged.minPrice);
    if (merged.maxPrice) params.set("maxPrice", merged.maxPrice);
    if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);

    router.push(`/marketplace${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({});
      }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 lg:flex-row lg:items-end lg:gap-4"
    >
      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Search</label>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={values.q}
            onChange={(e) => setValues((v) => ({ ...v, q: e.target.value }))}
            placeholder="Search produce…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Category</label>
        <Select
          value={values.category || ALL}
          onValueChange={(v) => apply({ category: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full lg:w-44">
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
        <label className="text-xs font-medium text-muted-foreground">County</label>
        <Select
          value={values.county || ALL}
          onValueChange={(v) => apply({ county: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full lg:w-40">
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

      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Min KES</label>
          <Input
            type="number"
            min="0"
            className="w-24"
            value={values.minPrice}
            onChange={(e) => setValues((v) => ({ ...v, minPrice: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Max KES</label>
          <Input
            type="number"
            min="0"
            className="w-24"
            value={values.maxPrice}
            onChange={(e) => setValues((v) => ({ ...v, maxPrice: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Sort by</label>
        <Select value={values.sort} onValueChange={(v) => apply({ sort: v })}>
          <SelectTrigger className="w-full lg:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="lg:mb-0">
        Apply
      </Button>
    </form>
  );
}
