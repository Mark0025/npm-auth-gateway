"use client";

import { Button } from "@/components/ui/button";
import { removeIp } from "@/actions/npm-actions";
import { useTransition } from "react";

/** Button to remove a specific IP address from an NPM access list */
export function RemoveIpButton({
  listId,
  address,
}: {
  listId: number;
  address: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      className="text-destructive hover:text-destructive h-6 px-2 text-xs"
      onClick={() => startTransition(() => removeIp(listId, address))}
    >
      {isPending ? "..." : "Remove"}
    </Button>
  );
}
