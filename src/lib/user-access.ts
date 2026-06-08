import "server-only";

/**
 * Effective user access data used across auth providers.
 * aclIds = NPM access list IDs the user is assigned to.
 * isAdmin = full access to all services + admin UI.
 */
export type UserAccess = {
  aclIds: number[];
  isAdmin: boolean;
};

/**
 * Extract access data from a Clerk metadata object.
 * Handles both new format { aclIds, isAdmin } and legacy { groups }.
 */
export function getUserAccess(
  publicMetadata: Record<string, unknown> | null | undefined,
): UserAccess {
  if (!publicMetadata) return { aclIds: [], isAdmin: false };

  // New format
  if ("aclIds" in publicMetadata) {
    return {
      aclIds: (publicMetadata.aclIds as number[] | undefined) ?? [],
      isAdmin: (publicMetadata.isAdmin as boolean | undefined) ?? false,
    };
  }

  // Legacy format: { groups: ["admin", "pete", ...] }
  if ("groups" in publicMetadata) {
    const groups = (publicMetadata.groups as string[] | undefined) ?? [];
    return {
      aclIds: [],
      isAdmin: groups.includes("admin"),
    };
  }

  return { aclIds: [], isAdmin: false };
}
