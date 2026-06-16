export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { generateQuickStory, generateBeginnerCharacters, generateEntity, bootstrapCharacterIntelligence } from "@/lib/ai/engine";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { db } from "@/db";
import { projects, characters, locations, plotThreads } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const session = await getRequiredSession();
    const rl = await checkAiRateLimit(session.user.id);
    if (rl) return rl;
    const gate = await meterAndGate(session.user.id, "quick-start");
    if (gate) return gate;
    const { projectId, title, format, genres } = await req.json();

    const owned = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
        // Generate quick story skeleton
        const skeleton = await generateQuickStory(title, format, genres);

        // Create characters from skeleton
        const createdCharacters: { id: string; name: string; role: string; age: string; personality: string }[] = [];
        if (skeleton.characters && Array.isArray(skeleton.characters)) {
            for (const char of skeleton.characters) {
                const [inserted] = await db.insert(characters).values({
                    projectId,
                    name: char.name || "Unnamed Character",
                    role: char.role || "",
                    age: char.age || "",
                    appearance: char.appearance || "",
                    personality: char.personality || "",
                    thinkingStyle: "",
                    behavior: "",
                    habits: "",
                    fears: "",
                    desires: "",
                    speechPattern: "",
                    backstory: "",
                    arc: "",
                    sortOrder: 0,
                }).returning();
                if (inserted) createdCharacters.push({ id: inserted.id, name: char.name, role: char.role || "", age: char.age || "", personality: char.personality || "" });
            }
        }

        // Bootstrap intelligence async — fires in background, does not block response
        const primaryGenre = (genres || [])[0] ?? '';
        for (const char of createdCharacters) {
            bootstrapCharacterIntelligence(char, primaryGenre, format)
                .then(async (intelligence) => {
                    if (Object.keys(intelligence).length === 0) return;
                    await db.update(characters)
                        .set(intelligence as any)
                        .where(eq(characters.id, char.id));
                })
                .catch(err => console.error('[bootstrap] Failed for', char.name, err));
        }

        // Create locations from skeleton
        if (skeleton.locations && Array.isArray(skeleton.locations)) {
            for (const loc of skeleton.locations) {
                await db.insert(locations).values({
                    projectId,
                    name: loc.name || "Unnamed Location",
                    description: loc.description || "",
                    atmosphere: loc.atmosphere || "",
                    history: "",
                    sensoryDetails: "",
                    sortOrder: 0,
                });
            }
        }

        // Create plot threads from skeleton
        if (skeleton.plotThreads && Array.isArray(skeleton.plotThreads)) {
            for (const plot of skeleton.plotThreads) {
                await db.insert(plotThreads).values({
                    projectId,
                    name: plot.name || "Unnamed Plot",
                    description: plot.description || "",
                    status: "Active",
                    stakes: plot.stakes || "",
                    connections: "",
                    sortOrder: 0,
                });
            }
        }

        // Update project with outline
        if (skeleton.outline) {
            await db.update(projects)
                .set({ notes: "AUTO-GENERATED OUTLINE:\n\n" + skeleton.outline })
                .where(eq(projects.id, projectId));
        }

        // Generate a sample opening paragraph to show the writer immediately
        let sampleGeneration = '';
        try {
            const { buildStaticContext, buildDynamicContext } = await import('@/lib/ai/context-builder');
            const { generate } = await import('@/lib/ai/engine');
            const contextProject = {
                ...owned,
                characters: createdCharacters,
                locations: [],
                plotThreads: [],
                chapters: [],
                referenceWorks: [],
                storyMemories: [],
                activeChapter: undefined,
            };
            const result = await generate({
                mode: 'write',
                format: owned.format,
                staticContext: buildStaticContext(contextProject as any),
                dynamicContext: buildDynamicContext(contextProject as any),
                prompt: `Write the opening paragraph of this story. One paragraph. This is the reader's first moment in this world — make it specific, grounded, and purposeful. Show us where we are and give us a reason to keep reading.`,
                maxTokens: 400,
            });
            sampleGeneration = result.text ?? '';
        } catch {
            // Sample generation failure must never block project creation
        }

        return NextResponse.json({
            success: true,
            projectId: owned.id,
            sampleGeneration,
            outline: skeleton.outline,
        });
    } catch (error) {
        console.error("Quick start error:", error);
        await refundCredits(session.user.id, "quick-start");
        return NextResponse.json(
            { error: "Failed to generate story skeleton" },
            { status: 500 }
        );
    }
}
