import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (allowedEmails.length === 0) {
        return true;
      }

      return Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
    },
  },
};
