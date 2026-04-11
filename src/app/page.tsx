import { getOptionalSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function Home(){ const s=await getOptionalSession(); if(s) redirect("/dashboard"); return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-extrabold text-brand mb-2">GhostWriter AI</h1><Link href="/login" className="px-8 py-3 bg-brand text-white rounded-xl font-bold">Get Started</Link></div></div>; }