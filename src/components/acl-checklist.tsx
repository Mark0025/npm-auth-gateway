"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toggleUserAcl, toggleUserAdmin } from "@/actions/user-actions";

type AclItem = {
  id: number;
  name: string;
  hosts: string[];
};

/** Checkbox list for toggling a user's admin role and per-ACL access assignments */
export function AclChecklist({
  userId,
  accessLists,
  assignedAclIds,
  isAdmin,
}: {
  userId: string;
  accessLists: AclItem[];
  assignedAclIds: number[];
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(aclId: number, checked: boolean) {
    startTransition(() => toggleUserAcl(userId, aclId, checked));
  }

  function handleAdminToggle(checked: boolean) {
    startTransition(() => toggleUserAdmin(userId, checked));
  }

  return (
    <div className="space-y-3">
      {/* Admin toggle */}
      <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
        <Checkbox
          checked={isAdmin}
          onCheckedChange={(c) => handleAdminToggle(c === true)}
          disabled={isPending}
        />
        <div>
          <span className="text-sm font-medium">Admin</span>
          <p className="text-xs text-muted-foreground">
            Full access to all services + admin UI. IP whitelisted on all ACLs.
          </p>
        </div>
      </label>

      {/* ACL toggles */}
      {accessLists.map((acl) => {
        const isAssigned = isAdmin || assignedAclIds.includes(acl.id);
        return (
          <label
            key={acl.id}
            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
          >
            <Checkbox
              checked={isAssigned}
              onCheckedChange={(c) => handleToggle(acl.id, c === true)}
              disabled={isPending || isAdmin}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{acl.name}</span>
                <Badge variant="outline" className="text-xs">
                  {acl.hosts.length} hosts
                </Badge>
              </div>
              {acl.hosts.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {acl.hosts.map((h) => (
                    <span
                      key={h}
                      className="text-xs text-muted-foreground font-mono"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No hosts assigned to this access list
                </p>
              )}
            </div>
          </label>
        );
      })}

      {accessLists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No access lists found in NPM
        </p>
      )}
    </div>
  );
}
