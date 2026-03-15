"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toggleUserAdmin } from "@/actions/user-actions";

/** Switch toggle to grant or revoke admin role for a user with confirmation prompt */
export function AdminToggle({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    if (checked) {
      if (!confirm("Grant admin access? This user will see all services and manage other users.")) return;
    }
    startTransition(() => toggleUserAdmin(userId, checked));
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Switch
        checked={isAdmin}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <Badge variant={isAdmin ? "default" : "outline"} className="text-xs">
        {isAdmin ? "Admin" : "User"}
      </Badge>
    </label>
  );
}
