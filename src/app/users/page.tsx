import { NavBar } from "@/components/nav-bar";
import { InviteUserForm } from "@/components/invite-user-form";
import { SearchableUserTable } from "@/components/searchable-user-table";
import {
  getUserCount,
  listUsers,
  supportsUserInvitation,
} from "@/lib/auth-provider";
import { getLoginLog } from "@/lib/login-log";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const canInviteUsers = supportsUserInvitation();
  const [authUsers, userCount, loginLog] = await Promise.all([
    listUsers(),
    getUserCount(),
    getLoginLog(),
  ]);

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
  const users = authUsers.map((user) => {
    const stats = loginsByUser.get(user.id);

    return {
      id: user.id,
      email: user.email,
      lastSignIn: user.lastSignInAt
        ? new Date(user.lastSignInAt).toLocaleDateString()
        : "Never",
      logins: stats?.count ?? 0,
      ips: stats?.ips.size ?? 0,
      aclCount: user.aclIds.length,
      isAdmin: user.isAdmin,
    };
  });

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">
          Users ({userCount})
        </h1>

        {canInviteUsers ? (
          <InviteUserForm />
        ) : (
          <p className="text-sm text-muted-foreground">
            Users appear here after their first successful sign-in. Invitations
            remain Clerk-only.
          </p>
        )}

        <SearchableUserTable users={users} />
      </main>
    </>
  );
}
