import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db) as any,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }),
    CredentialsProvider({ name:"credentials", credentials:{ email:{label:"Email",type:"email"}, password:{label:"Password",type:"password"} }, async authorize(cred){ if(!cred?.email||!cred?.password) return null; const user = await db.query.users.findFirst({where:eq(users.email,cred.email)}); if(!user) return null; return {id:user.id,name:user.name,email:user.email,image:user.image}; } }),
  ],
  callbacks: {
    async session({session,token}){ if(session.user&&token.sub) session.user.id=token.sub; return session; },
    async jwt({token,user}){ if(user) token.sub=user.id; return token; },
  },
};