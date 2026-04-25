import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { withSchemaSearchPath } from "@/db/client";

function buildAuthErrorRedirect(code: "not-allowed" | "google-conflict") {
  const params = new URLSearchParams({ authError: code });
  return `/?${params.toString()}`;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/",
    error: "/",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.trim().toLowerCase();
      const googleSub =
        account?.provider === "google" ? account.providerAccountId : null;

      if (!email || !googleSub) {
        return buildAuthErrorRedirect("not-allowed");
      }

      const outcome = await withSchemaSearchPath(async (client) => {
        const result = await client.query<{
          id: number;
          google_sub: string | null;
        }>(
          `
            SELECT id, google_sub
            FROM users
            WHERE lower(email) = $1
            LIMIT 1
          `,
          [email],
        );

        const allowedUser = result.rows[0];
        if (!allowedUser) {
          return "not-allowed" as const;
        }

        if (
          allowedUser.google_sub !== null &&
          allowedUser.google_sub !== googleSub
        ) {
          return "google-conflict" as const;
        }

        await client.query(
          `
            UPDATE users
            SET google_sub = COALESCE(google_sub, $2),
                avatar_url = $3
            WHERE id = $1
          `,
          [allowedUser.id, googleSub, user.image ?? null],
        );

        return "ok" as const;
      });

      if (outcome === "ok") {
        return true;
      }

      return buildAuthErrorRedirect(outcome);
    },
  },
});
