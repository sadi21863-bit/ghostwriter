import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { generateQuickStory, generateBeginnerCharacters, generateEntity } from "@/lib/ai/engine";
import { db } from "@/db";
import { projects, characters, locations, plotThreads } from "@/db/schema";

export async function POST(req: NextRequest) {
    await getRequiredSession();
    const { projectId, title, format, genres } = await req.json();

    try {
        // Generate quick story skeleton
        const skeleton = await generateQuickStory(title, format, genres);

        // Create characters from skeleton
        if (skeleton.characters && Array.isArray(skeleton.characters)) {
            for (const char of skeleton.characters) {
                await db.insert(characters).values({
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
                });
            }
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
                .where({ id: projectId });
        }

        return NextResponse.json({
            success: true,
            message: "Story skeleton generated",
            outline: skeleton.outline,
        });
    } catch (error) {
        console.error("Quick start error:", error);
        return NextResponse.json(
            { error: "Failed to generate story skeleton" },
            { status: 500 }
        );
    }
}
