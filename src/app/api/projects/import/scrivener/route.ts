export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects, chapters } from '@/db/schema';
import JSZip from 'jszip';
import { plainTextToTipTap } from '@/lib/editor/content-migration';

function stripRtf(rtf: string): string {
  let text = rtf;
  text = text.replace(/\{\\[\w-]+[^}]*\}/g, '');
  text = text.replace(/\\[a-z]+[-]?\d*\s?/g, ' ');
  text = text.replace(/[{}\\]/g, '');
  text = text.replace(/\\'([0-9a-f]{2})/gi, (_, hex) => {
    const code = parseInt(hex, 16);
    return isNaN(code) ? "" : String.fromCharCode(code);
  });
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const projectName = (formData.get('projectName') as string) ?? 'Imported Project';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const rtfFiles = Object.keys(zip.files)
    .filter(name => name.endsWith('.rtf') && !zip.files[name].dir)
    .sort();

  if (rtfFiles.length === 0) {
    return NextResponse.json({ error: 'No RTF files found. Export from Scrivener as RTF files.' }, { status: 400 });
  }

  const [project] = await db.insert(projects).values({
    userId: session.user.id,
    name: projectName,
    format: 'Novel',
    genres: [],
    premise: `Imported from Scrivener: ${file.name}`,
  } as any).returning();

  const createdChapters: any[] = [];
  for (let i = 0; i < rtfFiles.length; i++) {
    const rtfContent = await zip.files[rtfFiles[i]].async('string');
    const plainText = stripRtf(rtfContent);

    if (!plainText.trim()) continue;

    const fileName = rtfFiles[i].split('/').pop()?.replace('.rtf', '') ?? `Chapter ${i + 1}`;
    const title = fileName.replace(/^\d+[-_\s]*/, '').trim() || `Chapter ${i + 1}`;

    const [chapter] = await db.insert(chapters).values({
      projectId: project.id,
      title,
      content: JSON.stringify(plainTextToTipTap(plainText)),
      sortOrder: i,
      wordCount: plainText.split(/\s+/).filter(Boolean).length,
    }).returning();

    createdChapters.push(chapter);
  }

  return NextResponse.json({
    project,
    chaptersImported: createdChapters.length,
    message: `Imported ${createdChapters.length} chapters from ${rtfFiles.length} RTF files.`,
  });
}
