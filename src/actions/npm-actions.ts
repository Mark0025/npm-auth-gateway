"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  addIpToAccessList as npmAddIp,
  removeIpFromAccessList as npmRemoveIp,
  toggleProxyHost as npmToggleHost,
  deleteProxyHost as npmDeleteHost,
  assignAccessListToHost as npmAssignAcl,
} from "@/lib/npm-api";

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/proxy-hosts");
  revalidatePath("/access-lists");
}

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

// --- Access List IP Management ---

/** Add an allow-listed IP address to an NPM access list. */
export async function addIp(listId: number, ip: string) {
  await requireAuth();

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipRegex.test(ip)) throw new Error("Invalid IP address format");

  try {
    await npmAddIp(listId, ip, "allow");
  } catch (e) {
    console.error(`[action] addIp failed: list=${listId} ip=${ip}`, e instanceof Error ? e.message : e);
    throw new Error(`Failed to add IP: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  revalidateAll();
}

/** Remove an IP address from an NPM access list. */
export async function removeIp(listId: number, address: string) {
  await requireAuth();

  try {
    await npmRemoveIp(listId, address);
  } catch (e) {
    console.error(`[action] removeIp failed: list=${listId} addr=${address}`, e instanceof Error ? e.message : e);
    throw new Error(`Failed to remove IP: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  revalidateAll();
}

// --- Proxy Host Management ---

/** Enable or disable an NPM proxy host. */
export async function toggleHost(id: number, enabled: boolean) {
  await requireAuth();

  try {
    await npmToggleHost(id, enabled);
  } catch (e) {
    console.error(`[action] toggleHost failed: id=${id}`, e instanceof Error ? e.message : e);
    throw new Error(`Failed to toggle host: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  revalidateAll();
}

/** Permanently delete an NPM proxy host by ID. */
export async function deleteHost(id: number) {
  await requireAuth();

  try {
    await npmDeleteHost(id);
  } catch (e) {
    console.error(`[action] deleteHost failed: id=${id}`, e instanceof Error ? e.message : e);
    throw new Error(`Failed to delete host: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  revalidateAll();
}

/** Assign an NPM access list to a proxy host. */
export async function assignAccessList(hostId: number, accessListId: number) {
  await requireAuth();

  try {
    await npmAssignAcl(hostId, accessListId);
  } catch (e) {
    console.error(`[action] assignAccessList failed: host=${hostId} list=${accessListId}`, e instanceof Error ? e.message : e);
    throw new Error(`Failed to assign access list: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  revalidateAll();
}

// --- Access List CRUD ---

/** Create a new empty NPM access list with the given name. */
export async function createNewAccessList(name: string) {
  await requireAuth();

  if (!name || name.trim().length === 0) throw new Error("Name is required");

  const { createAccessList } = await import("@/lib/npm-api");
  try {
    await createAccessList(name.trim());
  } catch (e) {
    console.error(`[action] createAccessList failed: name=${name}`, e instanceof Error ? e.message : e);
    throw new Error(`Failed to create access list: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  revalidateAll();
}

// --- Revalidation ---

/** Revalidate all cached pages (dashboard, proxy-hosts, access-lists). */
export async function refreshAll() {
  await requireAuth();
  revalidateAll();
}
