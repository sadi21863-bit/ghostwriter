import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { redirect } from "next/navigation";
export async function getRequiredSession(){ const s=await getServerSession(authOptions); if(!s?.user?.id) redirect("/login"); return s; }
export async function getOptionalSession(){ return getServerSession(authOptions); }