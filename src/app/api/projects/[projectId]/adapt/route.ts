export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects, characters, locations, plotThreads } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserTier, canAccessFeature } from '@/lib/subscription';
import { track } from '@/lib/analytics';

// Source format -> allowed target formats. Mirrors AdaptPanel's ADAPT_TARGETS;
// only Novel<->Screenplay is actually wired (others would 400 here even if a
// client somehow submitted them, since their conversion routes don't exist yet).
const ADAPT_CAPABILITY_MAP: Record<string, string[]> = {
  Novel: ['Screenplay'],
  Screenplay: ['Novel'],
};

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const { targetFormat } = await req.json() as { targetFormat: string };
  const { projectId } = await params;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'export')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'export' }, { status: 403 });
  }

  const source = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    with: { characters: true, locations: true, plotThreads: true },
  });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowedTargets = ADAPT_CAPABILITY_MAP[source.format] ?? [];
  if (!allowedTargets.includes(targetFormat)) {
    return NextResponse.json({ error: `Cannot adapt ${source.format} to ${targetFormat}` }, { status: 400 });
  }

  // No project-count limit check here: every tier with "export" access
  // (story_pro, all_access) has an uncapped MAX_PROJECTS, so that check
  // would be unreachable dead code given the current tier configuration.

  const [target] = await db.insert(projects).values({
    userId: session.user.id,
    name: `${source.name} (${targetFormat})`,
    format: targetFormat,
    skillLevel: source.skillLevel,
    genres: source.genres,
    storyType: 'linear',
    adaptedFromProjectId: source.id,
  }).returning();

  // Copy World Bible into the new project as independent rows (fresh ids).
  // Cross-reference link arrays/ids point at rows in the SOURCE project and
  // would be wrong here, so they're reset rather than copied.
  if (source.characters.length > 0) {
    await db.insert(characters).values(source.characters.map((c: any) => {
      const { id, projectId: _pid, createdAt, updatedAt, linkedLocationIds, linkedPlotThreadIds, ...rest } = c;
      return { ...rest, projectId: target.id, linkedLocationIds: [], linkedPlotThreadIds: [] };
    }));
  }
  if (source.locations.length > 0) {
    await db.insert(locations).values(source.locations.map((l: any) => {
      const { id, projectId: _pid, createdAt, updatedAt, linkedCharacterIds, ...rest } = l;
      return { ...rest, projectId: target.id, linkedCharacterIds: [] };
    }));
  }
  if (source.plotThreads.length > 0) {
    await db.insert(plotThreads).values(source.plotThreads.map((t: any) => {
      const { id, projectId: _pid, createdAt, updatedAt, lastMentionedChapterId, ...rest } = t;
      return { ...rest, projectId: target.id, lastMentionedChapterId: null };
    }));
  }

  await track(session.user.id, 'project_adapted', { sourceFormat: source.format, targetFormat });
  return NextResponse.json({ newProjectId: target.id }, { status: 201 });
}
