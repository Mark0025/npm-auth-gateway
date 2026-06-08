import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getUserAccess as parseUserAccess, type UserAccess } from "@/lib/user-access";

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

function getOidcAccess(groups: string[] | undefined): UserAccess {
  return {
    aclIds: [],
    isAdmin: groups?.includes("admin") ?? false,
  };
}

export function getAuthProvider(): AuthProvider {
  return parseAuthProvider(process.env.AUTH_PROVIDER);
}

export function supportsUserManagement() {
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (getAuthProvider() === "oidc") {
    const { auth: getAuthSession } = await import("@/auth");
    const session = await getAuthSession();
    if (!session?.user?.id) return null;

    return {
      id: session.user.id,
      email: session.user.email || "no email",
      name: session.user.name,
      groups: normalizeGroups(session.user.groups),
    };
  }

  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const { aclIds: _aclIds, isAdmin: _isAdmin, ...authUser } = mapUser(user);
  return authUser;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  const access =
    getAuthProvider() === "oidc"
      ? getOidcAccess(user.groups)
      : await getUserAccess(user.id);

  if (!access.isAdmin) throw new Error("Admin access required");
  return user;
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  if (getAuthProvider() === "oidc") {
    const user = await getCurrentUser();
    if (!user || user.id !== userId) return { aclIds: [], isAdmin: false };
    return getOidcAccess(user.groups);
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return parseUserAccess(user.publicMetadata);
}

export async function setUserAccess(
  userId: string,
  aclIds: number[],
  isAdmin: boolean,
): Promise<void> {
  if (!supportsUserManagement()) {
    throw new Error("User access management is only supported with Clerk");
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { aclIds, isAdmin },
  });
}

export async function listUsers(): Promise<AuthProviderUser[]> {
  if (!supportsUserManagement()) {
    const user = await getCurrentUser();
    if (!user) return [];

    const access = getOidcAccess(user.groups);
    return [{ ...user, ...access, lastSignInAt: null }];
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({ limit: 100 });
  return users.data.map((user) => mapUser(user));
}

export async function getUserCount(): Promise<number> {
  if (!supportsUserManagement()) {
    const users = await listUsers();
    return users.length;
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({ limit: 1 });
  return users.totalCount;
}

export async function createUser(email: string): Promise<void> {
  if (!supportsUserManagement()) {
    throw new Error("Inviting users is only supported with Clerk");
  }

  const client = await clerkClient();
  await client.users.createUser({
    emailAddress: [email],
    publicMetadata: { aclIds: [], isAdmin: false },
    skipPasswordRequirement: true,
  });
}
