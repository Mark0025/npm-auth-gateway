import { NavBar } from "@/components/nav-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddIpForm } from "@/components/add-ip-form";
import { RemoveIpButton } from "@/components/remove-ip-button";
import { CreateAclForm } from "@/components/create-acl-form";
import { getAccessLists, getProxyHosts } from "@/lib/npm-api";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AccessListsPage() {
  const headersList = await headers();
  const currentIp =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const [accessLists, proxyHosts] = await Promise.all([
    getAccessLists(),
    getProxyHosts(),
  ]);

  // Map: which proxy hosts use each access list
  const hostsByList = new Map<number, string[]>();
  for (const host of proxyHosts) {
    if (host.access_list_id > 0) {
      const domains = hostsByList.get(host.access_list_id) ?? [];
      domains.push(host.domain_names[0] ?? `Host #${host.id}`);
      hostsByList.set(host.access_list_id, domains);
    }
  }

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Access Lists</h1>
            <p className="text-sm text-muted-foreground">
              {accessLists.length} access lists — Your IP: {currentIp}
            </p>
          </div>
          <CreateAclForm />
        </div>

        {accessLists.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-muted-foreground">
                No access lists configured in NPM.
              </p>
            </CardContent>
          </Card>
        ) : (
          accessLists.map((list) => {
            const associatedDomains = hostsByList.get(list.id) ?? [];
            const clients = list.clients ?? [];

            return (
              <Card key={list.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{list.name}</CardTitle>
                      <Badge variant="outline">{clients.length} IPs</Badge>
                      <Badge variant="secondary">
                        {list.proxy_host_count ?? associatedDomains.length} hosts
                      </Badge>
                    </div>
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      {list.satisfy_any && <Badge variant="outline">satisfy_any</Badge>}
                      {list.pass_auth && <Badge variant="outline">pass_auth</Badge>}
                    </div>
                  </div>
                  {associatedDomains.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Protects: {associatedDomains.slice(0, 5).join(", ")}
                      {associatedDomains.length > 5 &&
                        ` +${associatedDomains.length - 5} more`}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {clients.length > 0 && (
                    <div className="space-y-1">
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

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Add IP to this list:
                    </p>
                    <AddIpForm listId={list.id} currentIp={currentIp} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </>
  );
}
