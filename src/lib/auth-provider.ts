import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getUserAccess as parseUserAccess, type UserAccess } from "@/lib/user-access";
import {
  getStoredUser,
  listStoredUsers,
  setStoredUserAccess,
  syncStoredUserFromLogin,
  upsertStoredUser,
} from "@/lib/user-store";

export type AuthProvider = "clerk" | "oidc";
export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  groups?: string[];
};

export type AuthUserRecord = AuthUser & UserAccess;
export type AuthProviderUser = AuthUserRecord & {
  lastSignInAt?: number | null;
};

function parseAuthProvider(value: string | undefined): AuthProvider {
  return value?.trim().toLowerCase() === "oidc" ? "oidc" : "clerk";
}

function normalizeGroups(groups: unknown): string[] | undefined {
  if (!Array.isArray(groups)) return undefined;

  const normalized = groups.filter(
    (group): group is string => typeof group === "string",
  );

  return normalized.length > 0 ? normalized : undefined;
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAdminGroups() {
  return parseCsv(process.env.ADMIN_GROUPS);
}

function getAclGroupMap() {
  return parseCsv(process.env.ACL_GROUP_MAP)
    .map((entry) => {
      const [groupName, aclIdValue] = entry.split(":").map((item) => item.trim());
      const aclId = Number(aclIdValue);
      if (!groupName || Number.isNaN(aclId)) return null;
      return { groupName, aclId };
    })
    .filter((entry): entry is { groupName: string; aclId: number } => entry !== null);
}

function getDerivedGroupAccess(groups: string[] | undefined): UserAccess {
  const aclIds = getAclGroupMap()
    .filter((entry) => groups?.includes(entry.groupName))
    .map((entry) => entry.aclId);

  const isAdmin = getAdminGroups().some((group) => groups?.includes(group));

  return {
    aclIds: [...new Set(aclIds)],
    isAdmin,
  };
}

function toLastSignInAt(lastSeenAt: string | undefined) {
  if (!lastSeenAt) return null;
  const timestamp = Date.parse(lastSeenAt);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getAuthProvider(): AuthProvider {
  return parseAuthProvider(process.env.AUTH_PROVIDER);
}

export function supportsUserManagement() {
  return true;
}

export function supportsUserInvitation() {
  return getAuthProvider() === "clerk";
}

function getPrimaryEmail(user: {
  emailAddresses?: Array<{ emailAddress?: string | null }>;
}) {
  return user.emailAddresses?.[0]?.emailAddress ?? "no email";
}

function getDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}) {
  if (user.fullName) return user.fullName;

  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function mapUser(user: {
  id: string;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  publicMetadata?: Record<string, unknown> | null;
  lastSignInAt?: number | null;
}): AuthProviderUser {
  return {
    id: user.id,
    email: getPrimaryEmail(user),
    name: getDisplayName(user),
    lastSignInAt: user.lastSignInAt ?? null,
    ...parseUserAccess(user.publicMetadata),
  };
}

async function getClerkUserIdentity(userId: string): Promise<AuthUser | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const { aclIds: _aclIds, isAdmin: _isAdmin, lastSignInAt: _lastSignInAt, ...authUser } =
    mapUser(user);
  return authUser;
}

async function syncCurrentUserRecord(
  user: AuthUser,
  derivedAccess: UserAccess,
): Promise<UserAccess> {
  const record = await syncStoredUserFromLogin(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    derivedAccess,
  );

  return { aclIds: record.aclIds, isAdmin: record.isAdmin };
}

async function syncClerkUserRecord(user: {
  id: string;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  publicMetadata?: Record<string, unknown> | null;
}) {
  return syncCurrentUserRecord(
    {
      id: user.id,
      email: getPrimaryEmail(user),
      name: getDisplayName(user),
    },
    parseUserAccess(user.publicMetadata),
  );
}

async function getUserIdentity(userId: string): Promise<AuthUser | null> {
  const stored = await getStoredUser(userId);
  if (stored) {
    return {
      id: stored.id,
      email: stored.email,
      name: stored.name,
    };
  }

  const currentUser = await getCurrentUser();
  if (currentUser?.id === userId) {
    return currentUser;
  }

  if (getAuthProvider() === "clerk") {
    try {
      return await getClerkUserIdentity(userId);
    } catch {
      return null;
    }
  }

  return null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (getAuthProvider() === "oidc") {
    const { auth: getAuthSession } = await import("@/auth");
    const session = await getAuthSession();
    if (!session?.user?.id) return null;

    const currentUser = {
      id: session.user.id,
      email: session.user.email || "no email",
      name: session.user.name,
      groups: normalizeGroups(session.user.groups),
    };

    await syncCurrentUserRecord(currentUser, getDerivedGroupAccess(currentUser.groups));
    return currentUser;
  }

  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const { aclIds: _aclIds, isAdmin: _isAdmin, lastSignInAt: _lastSignInAt, ...authUser } =
    mapUser(user);
  await syncClerkUserRecord(user);
  return authUser;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  const access = await getUserAccess(user.id);

  if (!access.isAdmin) throw new Error("Admin access required");
  return user;
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  const stored = await getStoredUser(userId);
  if (stored?.hasLocalOverride) {
    return { aclIds: stored.aclIds, isAdmin: stored.isAdmin };
  }

  if (getAuthProvider() === "oidc") {
    const user = await getCurrentUser();
    if (!user || user.id !== userId) {
      return stored
        ? { aclIds: stored.aclIds, isAdmin: stored.isAdmin }
        : { aclIds: [], isAdmin: false };
    }

    return syncCurrentUserRecord(user, getDerivedGroupAccess(user.groups));
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return syncClerkUserRecord(user);
}

export async function setUserAccess(
  userId: string,
  aclIds: number[],
  isAdmin: boolean,
): Promise<void> {
  const identity = await getUserIdentity(userId);
  await setStoredUserAccess(userId, aclIds, isAdmin, {
    email: identity?.email,
    name: identity?.name,
  });
}

export async function listUsers(): Promise<AuthProviderUser[]> {
  if (getAuthProvider() === "oidc") {
    const storedUsers = await listStoredUsers();
    return storedUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      aclIds: user.aclIds,
      isAdmin: user.isAdmin,
      lastSignInAt: toLastSignInAt(user.lastSeenAt),
    }));
  }

  const storedUsers = await listStoredUsers();
  const storedById = new Map(storedUsers.map((user) => [user.id, user]));
  const client = await clerkClient();
  const users = await client.users.getUserList({ limit: 100 });

  return users.data.map((user) => {
    const mapped = mapUser(user);
    const stored = storedById.get(user.id);

    return {
      ...mapped,
      aclIds: stored?.aclIds ?? mapped.aclIds,
      isAdmin: stored?.isAdmin ?? mapped.isAdmin,
      lastSignInAt: stored ? toLastSignInAt(stored.lastSeenAt) : mapped.lastSignInAt,
    };
  });
}

export async function getUserCount(): Promise<number> {
  if (getAuthProvider() === "oidc") {
    const users = await listUsers();
    return users.length;
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({ limit: 1 });
  return users.totalCount;
}

export async function createUser(email: string): Promise<void> {
  if (!supportsUserInvitation()) {
    throw new Error("Inviting users is only supported with Clerk");
  }

  const client = await clerkClient();
  const user = await client.users.createUser({
    emailAddress: [email],
    publicMetadata: { aclIds: [], isAdmin: false },
    skipPasswordRequirement: true,
  });

  await upsertStoredUser({
    id: user.id,
    email: getPrimaryEmail(user),
    name: getDisplayName(user),
    aclIds: [],
    isAdmin: false,
  });
}
