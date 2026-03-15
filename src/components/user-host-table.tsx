"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toggleUserAcl } from "@/actions/user-actions";
import Link from "next/link";

type Host = {
  id: number;
  domain_names: string[];
  forward_host: string;
  forward_port: number;
  ssl_forced: boolean;
  certificate_id: number;
  access_list_id: number;
  enabled: boolean;
  category: string;
};

/** Map of ACL ID → list of domain names sharing that ACL */
type AclHostMap = Record<number, string[]>;

/** Per-user host access table with checkboxes to toggle ACL membership and shared-ACL warnings */
export function UserHostTable({
  hosts,
  userAclIds,
  userId,
  isAdmin,
  aclHostMap,
}: {
  hosts: Host[];
  userAclIds: number[];
  userId: string;
  isAdmin: boolean;
  aclHostMap: AclHostMap;
}) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = query
    ? hosts.filter((h) => {
        const q = query.toLowerCase();
        return (
          h.domain_names.some((d) => d.toLowerCase().includes(q)) ||
          h.forward_host.toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q)
        );
      })
    : hosts;

  function handleToggle(aclId: number, checked: boolean, sharedDomains: string[]) {
    if (aclId <= 0) return;

    // Warn if unchecking will affect other hosts sharing this ACL
    if (!checked && sharedDomains.length > 1) {
      const others = sharedDomains.slice(0, 5).join(", ");
      const more = sharedDomains.length > 5 ? ` and ${sharedDomains.length - 5} more` : "";
      if (
        !confirm(
          `This access list also protects:\n${others}${more}\n\nRemoving access will affect all of them. Continue?`,
        )
      ) {
        return;
      }
    }

    startTransition(() => toggleUserAcl(userId, aclId, checked));
  }

  return (
    <div className="space-y-2">
      <Input
        type="search"
        placeholder="Search hosts..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm h-8 text-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Access</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Forward To</TableHead>
            <TableHead>SSL</TableHead>
            <TableHead>ACL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((host) => {
            const isSSL = host.ssl_forced && host.certificate_id > 0;
            const domain = host.domain_names[0] ?? "";
            const isPublic = host.access_list_id <= 0;
            const hasAccess =
              isAdmin || isPublic || userAclIds.includes(host.access_list_id);
            const sharedDomains = aclHostMap[host.access_list_id] ?? [];

            return (
              <TableRow
                key={host.id}
                className={!host.enabled ? "opacity-50" : undefined}
              >
                <TableCell>
                  {isPublic ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Checkbox
                      checked={hasAccess}
                      disabled={isPending || isAdmin}
                      onCheckedChange={(c) =>
                        handleToggle(
                          host.access_list_id,
                          c === true,
                          sharedDomains,
                        )
                      }
                    />
                  )}
                </TableCell>
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
                    {host.category}
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
                  {isPublic ? (
                    <Badge variant="secondary" className="text-xs">
                      Public
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      #{host.access_list_id}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-sm text-muted-foreground py-4"
              >
                No hosts match &ldquo;{query}&rdquo;
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
