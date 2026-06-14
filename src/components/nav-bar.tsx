import { UserButton } from "@clerk/nextjs";
import { signIn, signOut } from "@/auth";
import { getAuthProvider, getCurrentUser, getUserAccess } from "@/lib/auth-provider";
import Link from "next/link";

async function AuthControls() {
  const provider = getAuthProvider();

  if (provider === "clerk") {
    return <UserButton />;
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("oidc", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
        >
          Sign in
        </button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signed-out" });
      }}
    >
      <button
        type="submit"
        className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
      >
        Sign out
      </button>
    </form>
  );
}

/** Top navigation bar with role-aware links and Clerk user button */
export async function NavBar() {
  let isAdmin = false;

  try {
    const user = await getCurrentUser();
    if (user) {
      const access = await getUserAccess(user.id);
      isAdmin = access.isAdmin;
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
      <AuthControls />
    </nav>
  );
}
