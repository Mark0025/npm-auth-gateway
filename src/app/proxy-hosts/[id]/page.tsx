import { NavBar } from "@/components/nav-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HostToggle } from "@/components/host-toggle";
import { DeleteHostButton } from "@/components/delete-host-button";
import { AssignAclSelect } from "@/components/assign-acl-select";
import { RemoveIpButton } from "@/components/remove-ip-button";
import { AddIpForm } from "@/components/add-ip-form";
import { getProxyHost, getAccessLists, getCertificates } from "@/lib/npm-api";
import { categorizeHost } from "@/lib/categorize";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProxyHostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hostId = parseInt(id, 10);
  if (isNaN(hostId)) notFound();

  let host;
  try {
    host = await getProxyHost(hostId);
  } catch {
    notFound();
  }

  const headersList = await headers();
  const currentIp =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const [accessLists, certificates] = await Promise.all([
    getAccessLists(),
    getCertificates(),
  ]);

  const accessList = accessLists.find((l) => l.id === host.access_list_id);
  const certificate = certificates.find((c) => c.id === host.certificate_id);
  const isSSL = host.ssl_forced && host.certificate_id > 0;
  const category = categorizeHost(host);
  const domain = host.domain_names[0] ?? "";

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/proxy-hosts"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Proxy Hosts
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{domain}</h1>
              <Badge variant="outline">{category}</Badge>
              {host.enabled && domain && (
                <a
                  href={`${isSSL ? "https" : "http"}://${domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Visit &rarr;
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Enabled</span>
                <HostToggle id={host.id} enabled={host.enabled} />
              </div>
              <DeleteHostButton id={host.id} domain={domain} />
            </div>
          </div>
          {host.domain_names.length > 1 && (
            <div className="flex gap-1 mt-1">
              {host.domain_names.slice(1).map((d) => (
                <Badge key={d} variant="outline">
                  {d}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Forward Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Forward Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Scheme" value={host.forward_scheme.toUpperCase()} />
              <Row label="Host" value={host.forward_host} />
              <Row label="Port" value={String(host.forward_port)} />
              <Row label="Caching" value={host.caching_enabled ? "Yes" : "No"} />
              <Row label="Block Exploits" value={host.block_exploits ? "Yes" : "No"} />
              <Row label="WebSocket" value={host.allow_websocket_upgrade ? "Yes" : "No"} />
              <Row label="HTTP/2" value={host.http2_support ? "Yes" : "No"} />
            </CardContent>
          </Card>

          {/* SSL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">SSL / Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="SSL Forced" value={isSSL ? "Yes" : "No"} />
              <Row label="HSTS" value={host.hsts_enabled ? "Yes" : "No"} />
              {certificate ? (
                <>
                  <Row label="Provider" value={certificate.provider} />
                  <Row label="Name" value={certificate.nice_name} />
                  <Row
                    label="Expires"
                    value={new Date(certificate.expires_on).toLocaleDateString()}
                  />
                </>
              ) : (
                <p className="text-muted-foreground">No certificate</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Access List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Access List</CardTitle>
              <AssignAclSelect
                hostId={host.id}
                currentAclId={host.access_list_id}
                accessLists={accessLists.map((l) => ({
                  id: l.id,
                  name: l.name,
                }))}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {accessList ? (
              <>
                {(accessList.clients?.length ?? 0) > 0 && (
                  <div className="space-y-1">
                    {(accessList.clients ?? []).map((client) => (
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
                          listId={accessList.id}
                          address={client.address}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <AddIpForm listId={accessList.id} currentIp={currentIp} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No access list — this host is public. Use the dropdown above to
                assign one.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Advanced Config */}
        {host.advanced_config && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Advanced Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                {host.advanced_config}
              </pre>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
