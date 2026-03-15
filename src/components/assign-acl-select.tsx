"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignAccessList } from "@/actions/npm-actions";

/** Dropdown to assign or remove an access list from a proxy host */
export function AssignAclSelect({
  hostId,
  currentAclId,
  accessLists,
}: {
  hostId: number;
  currentAclId: number;
  accessLists: { id: number; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function onChange(value: string | null) {
    if (!value) return;
    const aclId = parseInt(value, 10);
    if (isNaN(aclId)) return;
    startTransition(() => assignAccessList(hostId, aclId));
  }

  return (
    <Select
      value={String(currentAclId)}
      onValueChange={onChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="No access list" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">None (Public)</SelectItem>
        {accessLists.map((acl) => (
          <SelectItem key={acl.id} value={String(acl.id)}>
            {acl.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
