import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters, projects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { decrypt } from "@/lib/crypto";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: { projectId: string; characterId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const apiKey = decrypt(user?.higgsfieldApiKey ?? "") || process.env.HIGGSFIELD_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings to generate portraits." }, { status: 400 });

  const char = await db.query.characters.findFirst({ where: eq(characters.id, params.characterId) });
  if (!char) return NextResponse.json({ error: "Character not found" }, { status: 404 });
  if (!char.appearance) return NextResponse.json({ error: "Add an appearance description first." }, { status: 400 });

  const prompt = `Character portrait. ${char.name}${char.role ? ", " + char.role : ""}. Appearance: ${char.appearance}. Clean character art, detailed face, neutral expression, white background, concept art style. No text, no speech bubbles.`;

  const portraitUrl = await generateSoulImage({ apiKey, prompt });

  const [updated] = await db
    .update(characters)
    .set({ portraitUrl })
    .where(eq(characters.id, params.characterId))
    .returning();

  return NextResponse.json({ portraitUrl: updated.portraitUrl });
}
