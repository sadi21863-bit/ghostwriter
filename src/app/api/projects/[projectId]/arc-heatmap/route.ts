import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { tiptapToPlainText, isValidTipTapJson } from '@/lib/editor/content-migration';

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
    with: {
      characters: { columns: { id: true, name: true } },
      chapters: {
        columns: { id: true, title: true, content: true, sortOrder: true },
        orderBy: (c, { asc }) => [asc(c.sortOrder)],
      },
    },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { characters, chapters } = project as any;

  const presence = chapters.map((chapter: any) => {
    const text = chapter.content
      ? (isValidTipTapJson(chapter.content)
          ? tiptapToPlainText(JSON.parse(chapter.content))
          : chapter.content)
      : '';
    return characters.map((char: any) =>
      text.toLowerCase().includes(char.name.toLowerCase())
    );
  });

  return NextResponse.json({
    characters: characters.map((c: any) => ({ id: c.id, name: c.name })),
    chapters: chapters.map((c: any) => ({ id: c.id, title: c.title })),
    presence,
  });
}
