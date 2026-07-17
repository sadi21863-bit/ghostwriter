import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// @auth/drizzle-adapter v1.11.2 validates db type — must pass a real drizzle instance, not a Proxy.
const authDb = drizzle(neon(process.env.DATABASE_URL!), { schema });

// This installed next-auth version's default GoogleProvider profile() mapping
// returns only {id, name, email, image} - no emailVerified - even though Google
// itself reports it via the `email_verified` claim. Left at the default, every
// Google sign-in would land with emailVerified: null and incorrectly trip the
// real "verify your email" soft-gate in src/lib/metering/meter.ts (3 free
// generations, then blocked) despite having a genuinely verified account.
// Overriding profile() to map it through fixes this - confirmed the Drizzle
// adapter's createUser() inserts whatever profile() returns verbatim, so this
// is the correct place to fix it, not a workaround bolted on elsewhere.
const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        };
      },
    })]
  : [];

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(authDb),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...googleProvider,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(cred) {
        if (!cred?.email || !cred?.password) return null;
        const user = await db.query.users.findFirst({ where: eq(users.email, cred.email) });
        if (!user?.hashedPassword) return null;
        const valid = await bcrypt.compare(cred.password, user.hashedPassword);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      await db.insert(subscriptions).values({ userId: user.id }).onConflictDoNothing();
    },
  },
};
