import { clerkClient } from "@clerk/nextjs/server";
import { NavBar } from "@/components/nav-bar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserHostTable } from "@/components/user-host-table";
import { RevokeAccessButton } from "@/components/revoke-access-button";
import { AdminToggle } from "@/components/admin-toggle";
import { getLoginLog } from "@/lib/login-log";
import { getAccessLists, getProxyHosts } from "@/lib/npm-api";
import { getUserAccess } from "@/lib/user-access";
import { categorizeHost } from "@/lib/categorize";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;

  const client = await clerkClient();
  let user;
  try {
    user = await client.users.getUser(userId);
  } catch {
    notFound();
  }

  const [loginLog, accessLists, proxyHosts] = await Promise.all([
    getLoginLog(),
    getAccessLists(),
    getProxyHosts(),
  ]);

  const email = user.emailAddresses[0]?.emailAddress ?? "no email";
  const access = getUserAccess(user.publicMetadata);

  // Login history
  const userEntries = loginLog.filter((e) => e.userId === userId);
  const userIps = [...new Set(userEntries.map((e) => e.ip))];
  const loginCount = userEntries.length;
  const lastLogin =
    userEntries.length > 0
      ? userEntries.reduce((a, b) =>
          a.timestamp > b.timestamp ? a : b,
        ).timestamp
      : null;

  // Build ACL → domains map (for shared ACL warnings)
  const aclHostMap: Record<number, string[]> = {};
  for (const host of proxyHosts) {
    if (host.access_list_id > 0) {
      const domain = host.domain_names[0] ?? host.forward_host;
      aclHostMap[host.access_list_id] = aclHostMap[host.access_list_id] ?? [];
      aclHostMap[host.access_list_id].push(domain);
    }
  }

  // Pre-compute category + sort enabled first
  const hostsWithCategory = [...proxyHosts]
    .map((h) => ({ ...h, category: categorizeHost(h) }))
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return (a.domain_names[0] ?? "").localeCompare(b.domain_names[0] ?? "");
    });

  // Which ACLs currently contain this user's IPs
  const aclsWithUserIp = accessLists.filter((acl) =>
    (acl.clients ?? []).some((c) => userIps.includes(c.address)),
  );

  // Count assigned hosts (non-public hosts in user's ACLs)
  const assignedCount = proxyHosts.filter(
    (h) => h.access_list_id > 0 && access.aclIds.includes(h.access_list_id),
  ).length;

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href="/users"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Users
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{email}</h1>
            <p className="text-xs text-muted-foreground font-mono">{userId}</p>
          </div>
          <div className="flex items-center gap-2">
            <AdminToggle userId={userId} isAdmin={access.isAdmin} />
            <RevokeAccessButton userId={userId} />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Logins:</span>
            <span className="font-medium">{loginCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Last:</span>
            <span className="font-medium">
              {lastLogin ? new Date(lastLogin).toLocaleString() : "Never"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">IPs:</span>
            <div className="flex gap-1">
              {userIps.map((ip) => (
                <Badge key={ip} variant="outline" className="font-mono text-xs">
                  {ip}
                </Badge>
              ))}
              {userIps.length === 0 && (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Access:</span>
            {access.isAdmin ? (
              <Badge variant="default" className="text-xs">All (admin)</Badge>
            ) : (
              <span className="font-medium">{assignedCount} hosts</span>
            )}
          </div>
        </div>

        {/* IP presence in ACLs */}
        {aclsWithUserIp.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">IP whitelisted in:</span>
            {aclsWithUserIp.map((acl) => (
              <Badge key={acl.id} variant="secondary" className="text-xs">
                {acl.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Host table with checkboxes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Manage Host Access
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Check hosts to grant access. On login, this user&apos;s IP is
              auto-added to the access lists protecting checked hosts.
              Public hosts are accessible to everyone.
            </p>
          </CardHeader>
          <CardContent>
            <UserHostTable
              hosts={hostsWithCategory}
              userAclIds={access.aclIds}
              userId={userId}
              isAdmin={access.isAdmin}
              aclHostMap={aclHostMap}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
