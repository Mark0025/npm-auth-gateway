import { NavBar } from "@/components/nav-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddIpForm } from "@/components/add-ip-form";
import { RemoveIpButton } from "@/components/remove-ip-button";
import { CreateAclForm } from "@/components/create-acl-form";
import { ProxyHostTable } from "@/components/proxy-host-table";
import { listUsers } from "@/lib/auth-provider";
import { getProxyHosts, getAccessLists } from "@/lib/npm-api";
import { categorizeHost, CATEGORY_ORDER } from "@/lib/categorize";
import { getLoginLog } from "@/lib/login-log";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPanelPage() {
  const headersList = await headers();
  const currentIp =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  // Fetch all data in parallel
  const [proxyHosts, accessLists, loginLog, authUsers] = await Promise.all([
    getProxyHosts(),
    getAccessLists(),
    getLoginLog(),
    listUsers(),
  ]);

  // Build maps
  const hostsByAcl = new Map<number, typeof proxyHosts>();
  const publicHosts = proxyHosts.filter((h) => h.access_list_id === 0 && h.enabled);
  for (const host of proxyHosts) {
    if (host.access_list_id > 0) {
      const list = hostsByAcl.get(host.access_list_id) ?? [];
      list.push(host);
      hostsByAcl.set(host.access_list_id, list);
    }
  }

  // Login stats per user
  const loginsByUser = new Map<string, { ips: Set<string>; count: number; lastLogin: string }>();
  for (const entry of loginLog) {
    const stats = loginsByUser.get(entry.userId) ?? {
      ips: new Set<string>(),
      count: 0,
      lastLogin: "",
    };
    stats.ips.add(entry.ip);
    stats.count++;
    if (entry.timestamp > stats.lastLogin) stats.lastLogin = entry.timestamp;
    loginsByUser.set(entry.userId, stats);
  }

  // Category breakdown
  const categoryCounts = new Map<string, number>();
  for (const host of proxyHosts) {
    const cat = categorizeHost(host);
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Unified view: Clerk users + NPM access lists + proxy hosts — Your
            IP: {currentIp}
          </p>
        </div>

        {/* ── Section 1: Clerk Users ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">
            Users ({authUsers.length})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Clerk ID</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>IPs</TableHead>
                <TableHead>Access</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {authUsers.map((user) => {
                const email = user.email;
                const stats = loginsByUser.get(user.id);
                const isUserAdmin = user.isAdmin;
                const aclCount = user.aclIds.length;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{email}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.id.slice(0, 12)}...
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastSignInAt
                        ? new Date(user.lastSignInAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>{stats?.count ?? 0}</TableCell>
                    <TableCell>
                      {stats ? (
                        <div className="flex flex-wrap gap-1">
                          {[...stats.ips].map((ip) => (
                            <Badge
                              key={ip}
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {ip}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isUserAdmin && (
                          <Badge variant="default" className="text-xs">admin</Badge>
                        )}
                        {aclCount > 0 && (
                          <Badge variant="outline" className="text-xs">{aclCount} ACLs</Badge>
                        )}
                        {!isUserAdmin && aclCount === 0 && (
                          <span className="text-xs text-muted-foreground">No access</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/users/${user.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Manage
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        <Separator />

        {/* ── Section 2: NPM Access Lists ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              NPM Access Lists ({accessLists.length})
            </h2>
            <CreateAclForm />
          </div>

          {accessLists.map((list) => {
            const hosts = hostsByAcl.get(list.id) ?? [];
            const clients = list.clients ?? [];

            return (
              <Card key={list.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">
                        #{list.id} — {list.name}
                      </CardTitle>
                      <Badge variant="outline">{clients.length} IPs</Badge>
                      <Badge variant="secondary">{hosts.length} hosts</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* IPs */}
                  {clients.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Whitelisted IPs:
                      </p>
                      {clients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                client.directive === "allow"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {client.directive}
                            </Badge>
                            <span className="font-mono">{client.address}</span>
                          </div>
                          <RemoveIpButton
                            listId={list.id}
                            address={client.address}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hosts using this ACL */}
                  {hosts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Protects ({hosts.length} hosts):
                      </p>
                      <ProxyHostTable
                        hosts={hosts.sort((a, b) =>
                          (a.domain_names[0] ?? "").localeCompare(
                            b.domain_names[0] ?? ""
                          )
                        )}
                      />
                    </div>
                  )}

                  <Separator />
                  <AddIpForm listId={list.id} currentIp={currentIp} />
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Separator />

        {/* ── Section 3: All Proxy Hosts ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">
            All Proxy Hosts ({proxyHosts.length})
            {publicHosts.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {publicHosts.length} public
              </Badge>
            )}
          </h2>
          <ProxyHostTable
            hosts={[...proxyHosts].sort((a, b) => {
              if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
              return (a.domain_names[0] ?? "").localeCompare(b.domain_names[0] ?? "");
            })}
          />
        </section>

        <Separator />

        {/* ── Section 4: Category Breakdown ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Category Breakdown</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {CATEGORY_ORDER.map((cat) => (
              <Card key={cat}>
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold">
                    {categoryCounts.get(cat) ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">{cat}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
