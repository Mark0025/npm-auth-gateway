"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

type UserRow = {
  id: string;
  email: string;
  lastSignIn: string;
  logins: number;
  ips: number;
  aclCount: number;
  isAdmin: boolean;
};

/** Searchable user table with filtering by email, showing login stats and ACL counts */
export function SearchableUserTable({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? users.filter((u) => {
        const q = query.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        );
      })
    : users;

  return (
    <div className="space-y-2">
      <Input
        type="search"
        placeholder="Search by email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm h-8 text-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Last Sign In</TableHead>
            <TableHead>Logins</TableHead>
            <TableHead>IPs</TableHead>
            <TableHead>Access</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Link
                  href={`/users/${user.id}`}
                  className="font-medium hover:underline"
                >
                  {user.email}
                </Link>
                <p className="text-xs text-muted-foreground font-mono">
                  {user.id.slice(0, 16)}...
                </p>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.lastSignIn}
              </TableCell>
              <TableCell>{user.logins}</TableCell>
              <TableCell>{user.ips}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {user.isAdmin && (
                    <Badge variant="default" className="text-xs">
                      admin
                    </Badge>
                  )}
                  {user.aclCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {user.aclCount} ACLs
                    </Badge>
                  )}
                  {!user.isAdmin && user.aclCount === 0 && (
                    <span className="text-xs text-muted-foreground">
                      No access
                    </span>
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
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-sm text-muted-foreground py-4"
              >
                No users match &ldquo;{query}&rdquo;
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
