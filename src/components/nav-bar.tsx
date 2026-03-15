import { auth, clerkClient } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

/** Top navigation bar with role-aware links and Clerk user button */
export async function NavBar() {
  let isAdmin = false;

  try {
    const { userId } = await auth();
    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const meta = user.publicMetadata as Record<string, unknown> | undefined;
      // Support both new { isAdmin } and legacy { groups: ["admin"] }
      isAdmin =
        (meta?.isAdmin as boolean | undefined) ??
        ((meta?.groups as string[] | undefined) ?? []).includes("admin");
    }
  } catch {
    // Auth not available (e.g. public route) — show default nav
  }

  return (
    <nav className="flex items-center justify-between px-4 py-2 border-b bg-card">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold text-sm">
          NPM Auth Gateway
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/proxy-hosts"
            className="hover:text-foreground transition-colors"
          >
            Proxy Hosts
          </Link>
          <Link
            href="/access-lists"
            className="hover:text-foreground transition-colors"
          >
            Access Lists
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/users"
                className="hover:text-foreground transition-colors"
              >
                Users
              </Link>
              <Link
                href="/admin-panel"
                className="hover:text-foreground transition-colors"
              >
                Admin
              </Link>
            </>
          )}
          <Link
            href="/dev-man"
            className="hover:text-foreground transition-colors"
          >
            DEV-MAN
          </Link>
        </div>
      </div>
      <UserButton />
    </nav>
  );
}
