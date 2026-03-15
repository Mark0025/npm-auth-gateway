"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokeUserAccess } from "@/actions/user-actions";

/** Destructive button to remove a user's IPs from all NPM access lists */
export function RevokeAccessButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Remove this user's IPs from ALL access lists?")) return;
        startTransition(() => revokeUserAccess(userId));
      }}
    >
      {isPending ? "Revoking..." : "Revoke All Access"}
    </Button>
  );
}
