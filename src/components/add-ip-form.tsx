"use client";

import { Button } from "@/components/ui/button";
import { addIp } from "@/actions/npm-actions";
import { useTransition, useRef } from "react";

/** Form to add an IP address to an NPM access list, pre-filled with the user's current IP */
export function AddIpForm({
  listId,
  currentIp,
}: {
  listId: number;
  currentIp: string;
}) {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(formData: FormData) {
    const ip = formData.get("ip") as string;
    if (!ip) return;

    startTransition(async () => {
      await addIp(listId, ip);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <form action={handleSubmit} className="flex gap-2 items-center">
      <input
        ref={inputRef}
        name="ip"
        type="text"
        defaultValue={currentIp !== "unknown" ? currentIp : ""}
        placeholder="IP address (e.g. 203.0.113.42)"
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding..." : "Add IP"}
      </Button>
    </form>
  );
}
