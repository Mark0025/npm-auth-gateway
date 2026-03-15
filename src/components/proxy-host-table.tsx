import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProxyHost } from "@/lib/npm-api";
import { categorizeHost } from "@/lib/categorize";
import { HostToggle } from "@/components/host-toggle";
import Link from "next/link";

/** Table listing all proxy hosts with domain, category, forward target, SSL, ACL, and enable toggle */
export function ProxyHostTable({ hosts }: { hosts: ProxyHost[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Domain</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Forward To</TableHead>
          <TableHead>SSL</TableHead>
          <TableHead>Access List</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hosts.map((host) => {
          const category = categorizeHost(host);
          const isSSL = host.ssl_forced && host.certificate_id > 0;
          const domain = host.domain_names[0] ?? "";
          const scheme = isSSL ? "https" : "http";
          const siteUrl = domain ? `${scheme}://${domain}` : null;

          return (
            <TableRow
              key={host.id}
              className={!host.enabled ? "opacity-50" : undefined}
            >
              <TableCell>
                <Link
                  href={`/proxy-hosts/${host.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {domain || "—"}
                </Link>
                {host.domain_names.length > 1 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    +{host.domain_names.length - 1}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm font-mono">
                {host.forward_host}:{host.forward_port}
              </TableCell>
              <TableCell>
                {isSSL ? (
                  <Badge variant="default" className="text-xs">
                    SSL
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {host.access_list_id > 0 ? (
                  <Link
                    href="/access-lists"
                    className="text-primary hover:underline text-sm"
                  >
                    #{host.access_list_id}
                  </Link>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Public
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <HostToggle id={host.id} enabled={host.enabled} />
              </TableCell>
              <TableCell>
                {siteUrl && host.enabled && (
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                      Visit
                    </Button>
                  </a>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
