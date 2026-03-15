import "server-only";

import { getAccessLists, addIpToAccessList } from "@/lib/npm-api";
import type { UserAccess } from "@/lib/user-access";

/**
 * Auto-add a user's IP to their assigned NPM access lists.
 * Admin users get whitelisted on ALL access lists.
 */
export async function autoAddIp(
  access: UserAccess,
  ip: string,
): Promise<void> {
  if (ip === "unknown") return;
  if (!access.isAdmin && access.aclIds.length === 0) return;

  const accessLists = await getAccessLists();

  // Admin → all ACLs. Otherwise → only assigned ACL IDs.
  const targetAcls = access.isAdmin
    ? accessLists
    : accessLists.filter((a) => access.aclIds.includes(a.id));

  for (const acl of targetAcls) {
    const alreadyHasIp = (acl.clients ?? []).some((c) => c.address === ip);
    if (!alreadyHasIp) {
      try {
        await addIpToAccessList(acl.id, ip, "allow");
      } catch (e) {
        console.error(
          `[auto-ip] Failed to add ${ip} to ACL ${acl.id}:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
  }
}
