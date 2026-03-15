import { Suspense } from "react";
import { NavBar } from "@/components/nav-bar";
import { SearchableProxyTable } from "@/components/searchable-proxy-table";
import { CategoryFilter } from "@/components/category-filter";
import { RefreshButton } from "@/components/refresh-button";
import { getProxyHosts } from "@/lib/npm-api";
import { categorizeHost, CATEGORY_ORDER, type Category } from "@/lib/categorize";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ProxyHostsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const hosts = await getProxyHosts();

  // Build category counts
  const counts: Record<string, number> = {};
  for (const host of hosts) {
    const cat = categorizeHost(host);
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  // Filter by selected category
  const filtered = category
    ? hosts.filter((h) => categorizeHost(h) === category)
    : hosts;

  // Sort: enabled first, then alphabetically
  const sorted = [...filtered].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return (a.domain_names[0] ?? "").localeCompare(b.domain_names[0] ?? "");
  });

  const enabledCount = filtered.filter((h) => h.enabled).length;
  const disabledCount = filtered.length - enabledCount;
  const sslCount = filtered.filter((h) => h.ssl_forced && h.certificate_id > 0).length;
  const publicCount = filtered.filter((h) => h.access_list_id === 0).length;

  // Pre-compute category for client component
  const hostsWithCategory = sorted.map((h) => ({
    ...h,
    category: categorizeHost(h),
  }));

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Proxy Hosts</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{filtered.length} total</Badge>
              <Badge variant="default">{enabledCount} active</Badge>
              {disabledCount > 0 && (
                <Badge variant="secondary">{disabledCount} disabled</Badge>
              )}
              <Badge variant="outline">{sslCount} SSL</Badge>
              {publicCount > 0 && (
                <Badge variant="destructive">{publicCount} public</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Suspense>
              <CategoryFilter counts={counts} />
            </Suspense>
            <RefreshButton />
          </div>
        </div>

        <SearchableProxyTable hosts={hostsWithCategory} />
      </main>
    </>
  );
}
