import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProxyHost } from "@/lib/npm-api";
import Link from "next/link";

/** Clickable card displaying a proxy host's domain, status, SSL, and forward target */
export function ProxyHostCard({ host }: { host: ProxyHost }) {
  const domain = host.domain_names[0] ?? "unknown";
  const isSSL = host.ssl_forced && host.certificate_id > 0;

  return (
    <Link href={`/proxy-hosts/${host.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium truncate max-w-[200px]">
            {domain}
          </CardTitle>
          <div className="flex gap-1">
            {host.enabled ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
            {isSSL && <Badge variant="outline">SSL</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {host.forward_scheme}://{host.forward_host}:{host.forward_port}
          </p>
          {host.access_list_id > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Access List #{host.access_list_id}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
