import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signed-out" ||
    pathname === "/api/oidc-login" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth")
  );
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/users") || pathname.startsWith("/admin-panel");
}

async function oidcProxy(req: NextRequest, event: NextFetchEvent) {
  const { auth } = await import("@/auth");
  const { getUserAccess: getStoredAccess } = await import("@/lib/auth-provider");

  const handler = auth(async (authedReq) => {
    const { pathname } = authedReq.nextUrl;

    if (isPublicRoute(pathname)) return NextResponse.next();

    if (!authedReq.auth?.user) {
      return NextResponse.redirect(new URL("/login", authedReq.url));
    }

    if (isAdminRoute(pathname)) {
      const access = await getStoredAccess(authedReq.auth.user.id);
      if (!access.isAdmin) {
        return NextResponse.redirect(new URL("/dashboard", authedReq.url));
      }
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
  const { clerkMiddleware } = await import("@clerk/nextjs/server");
  const { getUserAccess: getEffectiveUserAccess } = await import("@/lib/auth-provider");

  const handler = clerkMiddleware(async (clerkAuth, request) => {
    const { pathname } = request.nextUrl;
    if (isPublicRoute(pathname)) return;

    const { userId } = await clerkAuth.protect();

    if (isAdminRoute(pathname)) {
      const access = await getEffectiveUserAccess(userId);

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
