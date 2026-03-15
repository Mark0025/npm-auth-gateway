import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const isAdminRoute = createRouteMatcher(["/users(.*)", "/admin-panel(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth.protect();

  if (isAdminRoute(req)) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    // Support both new { isAdmin } and legacy { groups: ["admin"] }
    const meta = user.publicMetadata as Record<string, unknown> | undefined;
    const isAdmin =
      (meta?.isAdmin as boolean | undefined) ??
      ((meta?.groups as string[] | undefined) ?? []).includes("admin");

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
