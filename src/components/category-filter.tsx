"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_ORDER } from "@/lib/categorize";
import { useRouter, useSearchParams } from "next/navigation";

/** Dropdown filter for proxy host categories with per-category counts */
export function CategoryFilter({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("category") ?? "all";

  function onChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("category");
    } else {
      params.set("category", value);
    }
    router.push(`?${params.toString()}`);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="All categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All categories ({total})</SelectItem>
        {CATEGORY_ORDER.map((cat) =>
          counts[cat] ? (
            <SelectItem key={cat} value={cat}>
              {cat} ({counts[cat]})
            </SelectItem>
          ) : null
        )}
      </SelectContent>
    </Select>
  );
}
