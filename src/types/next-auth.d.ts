import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      groups?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    groups?: string[];
  }
}
