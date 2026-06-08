import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { getUserAccess } from "@/lib/user-access";

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth")
  );
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/users") || pathname.startsWith("/admin-panel");
}

function isAdminGroup(groups: string[] | undefined) {
  return groups?.includes("admin") ?? false;
}

async function oidcProxy(req: NextRequest, event: NextFetchEvent) {
  const { auth } = await import("@/auth");

  const handler = auth((authedReq) => {
    const { pathname } = authedReq.nextUrl;

    if (isPublicRoute(pathname)) return NextResponse.next();

    if (!authedReq.auth?.user) {
      return NextResponse.redirect(new URL("/login", authedReq.url));
    }

    if (isAdminRoute(pathname) && !isAdminGroup(authedReq.auth.user.groups)) {
      return NextResponse.redirect(new URL("/dashboard", authedReq.url));
    }

    return NextResponse.next();
  });

  const middleware = handler as unknown as (
    request: NextRequest,
    nextEvent: NextFetchEvent,
  ) => Promise<Response>;

  return middleware(req, event);
}

async function clerkProxy(req: NextRequest, event: NextFetchEvent) {
  const { clerkMiddleware, clerkClient } = await import("@clerk/nextjs/server");

  const handler = clerkMiddleware(async (clerkAuth, request) => {
    const { pathname } = request.nextUrl;
    if (isPublicRoute(pathname)) return;

    const { userId } = await clerkAuth.protect();

    if (isAdminRoute(pathname)) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const access = getUserAccess(user.publicMetadata);

      if (!access.isAdmin) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  });

  return handler(req, event);
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (process.env.AUTH_PROVIDER?.trim().toLowerCase() === "oidc") {
    return oidcProxy(req, event);
  }

  return clerkProxy(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
