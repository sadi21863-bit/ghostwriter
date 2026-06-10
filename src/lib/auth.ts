import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(authDb),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
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
