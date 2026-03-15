"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
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
import { HostToggle } from "@/components/host-toggle";
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

/** Searchable proxy host table with client-side filtering by domain, host, and category */
export function SearchableProxyTable({ hosts }: { hosts: Host[] }) {
  const [query, setQuery] = useState("");

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

  return (
    <div className="space-y-2">
      <Input
        type="search"
        placeholder="Search domains, hosts, categories..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm h-8 text-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Forward To</TableHead>
            <TableHead>SSL</TableHead>
            <TableHead>Access List</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((host) => {
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                      >
                        Visit
                      </Button>
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
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
