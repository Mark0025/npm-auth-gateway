import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/nav-bar";
import { getProxyHosts, getAccessLists, getCertificates, type ProxyHost } from "@/lib/npm-api";
import { appendLoginLog } from "@/lib/login-log";
import { autoAddIp } from "@/lib/auto-ip";
import { getCurrentUser, getUserAccess } from "@/lib/auth-provider";
import type { UserAccess } from "@/lib/user-access";
import { categorizeHost, CATEGORY_ORDER } from "@/lib/categorize";
import Link from "next/link";

export default async function Dashboard() {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  // Log login
  if (userId) await appendLoginLog(userId, ip);

  // Get user's access config
  let access: UserAccess = { aclIds: [], isAdmin: false };
  let userEmail = "";
  if (user) {
    try {
      access = await getUserAccess(user.id);
      userEmail = user.email;
    } catch {
      // Clerk API unavailable
    }
  }

  // Auto-add IP to assigned NPM access lists
  if (userId && ip !== "unknown" && (access.isAdmin || access.aclIds.length > 0)) {
    try {
      await autoAddIp(access, ip);
    } catch (e) {
      console.error(
        "[dashboard] auto-IP failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Fetch NPM data
  let proxyHosts: Awaited<ReturnType<typeof getProxyHosts>> | null = null;
  let accessLists: Awaited<ReturnType<typeof getAccessLists>> | null = null;
  let certificates: Awaited<ReturnType<typeof getCertificates>> | null = null;
  let npmError = false;

  try {
    [proxyHosts, accessLists, certificates] = await Promise.all([
      getProxyHosts(),
      getAccessLists(),
      getCertificates(),
    ]);
  } catch (e) {
    npmError = true;
    console.error("[dashboard] NPM API unreachable:", e instanceof Error ? e.message : e);
  }

  // Filter hosts based on access
  // Admin: sees everything
  // Non-admin with ACLs: sees hosts in their ACLs + public hosts
  // Non-admin with no ACLs: sees only public hosts
  const visibleHosts = access.isAdmin
    ? proxyHosts
    : proxyHosts?.filter(
        (h) =>
          h.access_list_id === 0 || access.aclIds.includes(h.access_list_id),
      ) ?? null;

  // Only show enabled hosts as cards
  const enabledHosts = visibleHosts?.filter((h) => h.enabled) ?? [];

  // Group by category for admin view
  const hostsByCategory = new Map<string, typeof enabledHosts>();
  for (const host of enabledHosts) {
    const cat = categorizeHost(host);
    const list = hostsByCategory.get(cat) ?? [];
    list.push(host);
    hostsByCategory.set(cat, list);
  }

  // For non-admin: separate assigned hosts from public
  const assignedHosts = access.isAdmin
    ? []
    : enabledHosts.filter((h) => h.access_list_id > 0);
  const publicHosts = enabledHosts.filter((h) => h.access_list_id === 0);

  const firstName = userEmail.split("@")[0] ?? "";

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {access.isAdmin ? "NPM Auth Gateway" : `Welcome, ${firstName}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {access.isAdmin
                ? `${enabledHosts.length} active hosts | admin`
                : assignedHosts.length > 0
                  ? `${assignedHosts.length} hosts assigned to you`
                  : "No hosts assigned yet — ask your admin for access"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">{ip}</p>
            {access.isAdmin && (
              <Badge variant="default" className="text-xs mt-1">admin</Badge>
            )}
          </div>
        </div>

        {npmError ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-muted-foreground">
                Could not connect to NPM API. Make sure the container is running
                on the nginx-network.
              </p>
            </CardContent>
          </Card>
        ) : access.isAdmin ? (
          /* ── Admin View: grouped by category ── */
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Active Hosts"
                value={enabledHosts.length}
                sub={`${proxyHosts?.length ?? 0} total`}
              />
              <StatCard
                title="SSL Certs"
                value={certificates?.length ?? 0}
                sub={`${enabledHosts.filter((h) => h.ssl_forced && h.certificate_id > 0).length} hosts with SSL`}
              />
              <StatCard
                title="Access Lists"
                value={accessLists?.length ?? 0}
                sub={`${enabledHosts.filter((h) => h.access_list_id > 0).length} protected`}
              />
              <StatCard
                title="Public"
                value={publicHosts.length}
                sub="No ACL"
              />
            </div>

            {/* Category groups */}
            {CATEGORY_ORDER.map((cat) => {
              const hosts = hostsByCategory.get(cat);
              if (!hosts || hosts.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-muted-foreground">{cat}</h2>
                    <Badge variant="outline" className="text-xs">{hosts.length}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {hosts
                      .sort((a, b) => (a.domain_names[0] ?? "").localeCompare(b.domain_names[0] ?? ""))
                      .map((host) => (
                        <HostCard key={host.id} host={host} />
                      ))}
                  </div>
                </div>
              );
            })}

            {/* Admin quick links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <QuickLink href="/proxy-hosts" title="All Proxy Hosts" desc="Table view with search" />
              <QuickLink href="/users" title="Manage Users" desc="Invite, assign access, revoke" />
              <QuickLink href="/access-lists" title="Access Lists" desc="Manage IP whitelists" />
            </div>
          </>
        ) : (
          /* ── Non-Admin View: their hosts as cards ── */
          <>
            {assignedHosts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">Your Services</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {assignedHosts
                    .sort((a, b) => (a.domain_names[0] ?? "").localeCompare(b.domain_names[0] ?? ""))
                    .map((host) => (
                      <HostCard key={host.id} host={host} />
                    ))}
                </div>
              </div>
            )}

            {assignedHosts.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No services assigned to you yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your admin can grant access from the Users page.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}

function HostCard({ host }: { host: ProxyHost }) {
  const domain = host.domain_names[0] ?? "";
  const isSSL = host.ssl_forced && host.certificate_id > 0;
  const scheme = isSSL ? "https" : "http";
  const siteUrl = domain ? `${scheme}://${domain}` : null;
  // Show subdomain prefix if domain has 3+ parts, otherwise full domain
  const parts = domain.split(".");
  const shortDomain = parts.length >= 3 ? parts[0] : domain;
  const category = categorizeHost(host);

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div>
          <Link
            href={`/proxy-hosts/${host.id}`}
            className="text-sm font-medium hover:underline text-primary leading-tight"
          >
            {shortDomain || domain || "—"}
          </Link>
          {parts.length >= 3 && (
            <p className="text-xs text-muted-foreground">.{parts.slice(1).join(".")}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-xs">{category}</Badge>
          {isSSL && <Badge variant="default" className="text-xs">SSL</Badge>}
          {host.access_list_id === 0 && (
            <Badge variant="secondary" className="text-xs">Public</Badge>
          )}
        </div>
        {siteUrl && (
          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="text-xs h-7 w-full">
              Visit
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold truncate">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
