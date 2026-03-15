"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getUserAccess } from "@/lib/user-access";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const access = getUserAccess(user.publicMetadata);

  if (!access.isAdmin) throw new Error("Admin access required");
  return userId;
}

/** Overwrite a user's ACL list and admin flag in Clerk metadata. */
export async function setUserAccess(
  targetUserId: string,
  aclIds: number[],
  isAdmin: boolean,
) {
  await requireAdmin();

  const client = await clerkClient();
  await client.users.updateUserMetadata(targetUserId, {
    publicMetadata: { aclIds, isAdmin },
  });

  revalidatePath("/users");
  revalidatePath(`/users/${targetUserId}`);
  revalidatePath("/admin-panel");
}

/** Add or remove a single ACL from a user's allowed access lists. */
export async function toggleUserAcl(
  targetUserId: string,
  aclId: number,
  enabled: boolean,
) {
  await requireAdmin();

  const client = await clerkClient();
  const user = await client.users.getUser(targetUserId);
  const access = getUserAccess(user.publicMetadata);

  const newAclIds = enabled
    ? [...new Set([...access.aclIds, aclId])]
    : access.aclIds.filter((id) => id !== aclId);

  await client.users.updateUserMetadata(targetUserId, {
    publicMetadata: { aclIds: newAclIds, isAdmin: access.isAdmin },
  });

  revalidatePath("/users");
  revalidatePath(`/users/${targetUserId}`);
}

/** Grant or revoke admin privileges for a user. */
export async function toggleUserAdmin(
  targetUserId: string,
  isAdmin: boolean,
) {
  await requireAdmin();

  const client = await clerkClient();
  const user = await client.users.getUser(targetUserId);
  const access = getUserAccess(user.publicMetadata);

  await client.users.updateUserMetadata(targetUserId, {
    publicMetadata: { aclIds: access.aclIds, isAdmin },
  });

  revalidatePath("/users");
  revalidatePath(`/users/${targetUserId}`);
  revalidatePath("/admin-panel");
}

/** Create a new Clerk user by email with default (no-access) metadata. */
export async function inviteUser(email: string) {
  await requireAdmin();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error("Invalid email address");

  const client = await clerkClient();

  try {
    await client.users.createUser({
      emailAddress: [email],
      publicMetadata: { aclIds: [], isAdmin: false },
      skipPasswordRequirement: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("already exists") || msg.includes("taken")) {
      throw new Error("A user with this email already exists");
    }
    console.error(`[action] inviteUser failed: email=${email}`, msg);
    throw new Error(`Failed to create user: ${msg}`);
  }

  revalidatePath("/users");
  revalidatePath("/admin-panel");
}

/** Remove all of a user's logged IPs from every NPM access list. */
export async function revokeUserAccess(targetUserId: string) {
  await requireAdmin();

  const { getLoginLog } = await import("@/lib/login-log");
  const { getAccessLists, removeIpFromAccessList } = await import(
    "@/lib/npm-api"
  );

  const loginLog = await getLoginLog();
  const userIps = new Set(
    loginLog
      .filter((e) => e.userId === targetUserId)
      .map((e) => e.ip)
      .filter((ip) => ip !== "unknown"),
  );

  if (userIps.size === 0) return;

  const accessLists = await getAccessLists();
  for (const list of accessLists) {
    for (const client of list.clients ?? []) {
      if (userIps.has(client.address)) {
        try {
          await removeIpFromAccessList(list.id, client.address);
        } catch (e) {
          console.error(
            `[revoke] Failed to remove ${client.address} from ACL ${list.id}:`,
            e instanceof Error ? e.message : e,
          );
        }
      }
    }
  }

  revalidatePath("/users");
  revalidatePath(`/users/${targetUserId}`);
  revalidatePath("/access-lists");
  revalidatePath("/dashboard");
}
