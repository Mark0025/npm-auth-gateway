"use client";

import { Button } from "@/components/ui/button";
import { refreshAll } from "@/actions/npm-actions";
import { useTransition } from "react";

/** Button that triggers a full cache refresh of all NPM data */
export function RefreshButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => refreshAll())}
    >
      {isPending ? "Refreshing..." : "Refresh"}
    </Button>
  );
}
