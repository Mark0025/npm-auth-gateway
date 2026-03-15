"use client";

import { Button } from "@/components/ui/button";
import { createNewAccessList } from "@/actions/npm-actions";
import { useTransition, useRef } from "react";

/** Form to create a new NPM access list by name */
export function CreateAclForm() {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(formData: FormData) {
    const name = formData.get("name") as string;
    if (!name) return;

    startTransition(async () => {
      await createNewAccessList(name);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <form action={handleSubmit} className="flex gap-2 items-center">
      <input
        ref={inputRef}
        name="name"
        type="text"
        placeholder="New access list name (e.g. Pete, Tools)"
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating..." : "Create ACL"}
      </Button>
    </form>
  );
}
