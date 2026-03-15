import { clerkClient } from "@clerk/nextjs/server";
import { NavBar } from "@/components/nav-bar";
import { Badge } from "@/components/ui/badge";
import { InviteUserForm } from "@/components/invite-user-form";
import { SearchableUserTable } from "@/components/searchable-user-table";
import { getLoginLog } from "@/lib/login-log";
import { getUserAccess } from "@/lib/user-access";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({ limit: 100 });
  const loginLog = await getLoginLog();

  // Aggregate login stats per user
  const loginsByUser = new Map<
    string,
    { ips: Set<string>; count: number }
  >();
  for (const entry of loginLog) {
    const s = loginsByUser.get(entry.userId) ?? {
      ips: new Set<string>(),
      count: 0,
    };
    s.ips.add(entry.ip);
    s.count++;
    loginsByUser.set(entry.userId, s);
  }

  // Prepare serializable user data for client component
  const users = clerkUsers.data.map((user) => {
    const email = user.emailAddresses[0]?.emailAddress ?? "no email";
    const access = getUserAccess(user.publicMetadata);
    const stats = loginsByUser.get(user.id);

    return {
      id: user.id,
      email,
      lastSignIn: user.lastSignInAt
        ? new Date(user.lastSignInAt).toLocaleDateString()
        : "Never",
      logins: stats?.count ?? 0,
      ips: stats?.ips.size ?? 0,
      aclCount: access.aclIds.length,
      isAdmin: access.isAdmin,
    };
  });

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">
          Users ({clerkUsers.totalCount})
        </h1>

        <InviteUserForm />

        <SearchableUserTable users={users} />
      </main>
    </>
  );
}
