import "server-only";

import { randomUUID } from "crypto";
import { dirname, join } from "path";
import { mkdir, open, readFile, rename, unlink, writeFile } from "fs/promises";

export type StoredUser = {
  id: string;
  email: string;
  name?: string;
  aclIds: number[];
  isAdmin: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
};

type UpsertStoredUserInput = {
  id: string;
  email?: string;
  name?: string | null;
  aclIds?: number[];
  isAdmin?: boolean;
  seenAt?: string;
};

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const USERS_FILE = join(DATA_DIR, "users.json");
const LOCK_FILE = `${USERS_FILE}.lock`;

async function ensureStoreDir() {
  await mkdir(dirname(USERS_FILE), { recursive: true });
}

async function readStoreUnsafe(): Promise<StoredUser[]> {
  try {
    const raw = await readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is StoredUser => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof item.id === "string" &&
          typeof item.email === "string" &&
          Array.isArray((item as StoredUser).aclIds) &&
          typeof (item as StoredUser).isAdmin === "boolean" &&
          typeof (item as StoredUser).firstSeenAt === "string" &&
          typeof (item as StoredUser).lastSeenAt === "string"
        );
      })
      .map((item) => ({
        ...item,
        name: item.name ?? undefined,
        aclIds: item.aclIds.filter((id): id is number => typeof id === "number"),
      }));
  } catch {
    return [];
  }
}

async function acquireLock(retries = 50, delayMs = 25) {
  await ensureStoreDir();

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await open(LOCK_FILE, "wx");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Timed out acquiring user store lock");
}

async function writeStoreUnsafe(users: StoredUser[]) {
  await ensureStoreDir();
  const tempFile = `${USERS_FILE}.${process.pid}.${randomUUID()}.tmp`;
  const data = JSON.stringify(users, null, 2);
  await writeFile(tempFile, data, "utf-8");
  await rename(tempFile, USERS_FILE);
}

async function updateStore<T>(updater: (users: StoredUser[]) => Promise<T> | T) {
  const lock = await acquireLock();
  try {
    const users = await readStoreUnsafe();
    const result = await updater(users);
    await writeStoreUnsafe(users);
    return result;
  } finally {
    await lock.close();
    await unlink(LOCK_FILE).catch(() => undefined);
  }
}

export async function listStoredUsers(): Promise<StoredUser[]> {
  const users = await readStoreUnsafe();
  return users.sort((a, b) => a.email.localeCompare(b.email));
}

export async function getStoredUser(userId: string): Promise<StoredUser | null> {
  const users = await readStoreUnsafe();
  return users.find((user) => user.id === userId) ?? null;
}

export async function upsertStoredUser({
  id,
  email,
  name,
  aclIds,
  isAdmin,
  seenAt,
}: UpsertStoredUserInput): Promise<StoredUser> {
  return updateStore((users) => {
    const now = seenAt ?? new Date().toISOString();
    const existing = users.find((user) => user.id === id);

    if (existing) {
      existing.email = email ?? existing.email;
      existing.name = name ?? existing.name;
      existing.aclIds = aclIds ?? existing.aclIds;
      existing.isAdmin = isAdmin ?? existing.isAdmin;
      existing.lastSeenAt = now;
      return existing;
    }

    const created: StoredUser = {
      id,
      email: email ?? "unknown",
      name: name ?? undefined,
      aclIds: aclIds ?? [],
      isAdmin: isAdmin ?? false,
      firstSeenAt: now,
      lastSeenAt: now,
    };
    users.push(created);
    return created;
  });
}

export async function setStoredUserAccess(
  userId: string,
  aclIds: number[],
  isAdmin: boolean,
  identity?: {
    email?: string;
    name?: string | null;
  },
): Promise<StoredUser> {
  return updateStore((users) => {
    const now = new Date().toISOString();
    const existing = users.find((user) => user.id === userId);

    if (existing) {
      existing.email = identity?.email ?? existing.email;
      existing.name = identity?.name ?? existing.name;
      existing.aclIds = aclIds;
      existing.isAdmin = isAdmin;
      existing.lastSeenAt = now;
      return existing;
    }

    const created: StoredUser = {
      id: userId,
      email: identity?.email ?? "unknown",
      name: identity?.name ?? undefined,
      aclIds,
      isAdmin,
      firstSeenAt: now,
      lastSeenAt: now,
    };
    users.push(created);
    return created;
  });
}
