import NextAuth from "next-auth";
import type { OIDCConfig } from "@auth/core/providers";

type OidcProfile = {
  sub?: string;
  email?: string | null;
  name?: string | null;
  preferred_username?: string | null;
  groups?: unknown;
};

function normalizeGroups(groups: unknown): string[] | undefined {
  if (!Array.isArray(groups)) return undefined;

  const normalized = groups.filter(
    (group): group is string => typeof group === "string",
  );

  return normalized.length > 0 ? normalized : undefined;
}

function isOidcEnabled() {
  return process.env.AUTH_PROVIDER?.trim().toLowerCase() === "oidc";
}

function getOidcProvider(): OIDCConfig<OidcProfile> {
  return {
    id: "oidc",
    name: "OIDC",
    type: "oidc",
    issuer: process.env.OIDC_ISSUER ?? "https://invalid.local",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    profile(profile) {
      return {
        id: String(profile.sub ?? ""),
        email: profile.email ?? "",
        name: profile.name ?? profile.preferred_username ?? null,
      };
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: isOidcEnabled() ? [getOidcProvider()] : [],
  callbacks: {
    jwt({ token, profile }) {
      const groups = normalizeGroups((profile as OidcProfile | undefined)?.groups);
      if (groups) token.groups = groups;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = typeof token.email === "string" ? token.email : "";
        session.user.name =
          typeof token.name === "string" ? token.name : session.user.name ?? null;
        session.user.groups = normalizeGroups(token.groups);
      }

      return session;
    },
  },
});
