"use client";

import { Switch } from "@/components/ui/switch";
import { toggleHost } from "@/actions/npm-actions";
import { useTransition } from "react";

/** Switch toggle to enable or disable a proxy host via NPM API */
export function HostToggle({ id, enabled }: { id: number; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={enabled}
      disabled={isPending}
      onCheckedChange={(checked) =>
        startTransition(() => toggleHost(id, checked))
      }
    />
  );
}
