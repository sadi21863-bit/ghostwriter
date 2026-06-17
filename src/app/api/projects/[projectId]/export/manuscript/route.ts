export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType } from 'docx';
import { tiptapToPlainText, isValidTipTapJson } from '@/lib/editor/content-migration';
import { track } from '@/lib/analytics';

// Screenplay structural cues (see engine.ts's SCREENPLAY FORMAT RULES, which
// instructs the AI to produce exactly this plain-text shape): a scene heading
// starts with INT./EXT., a character cue is a short ALL CAPS line, anything
// in parens on its own line is a parenthetical, everything else is action/dialogue.
export const SCENE_HEADING_RE = /^(INT|EXT|INT\.?\/EXT|I\/E)[.\s]/i;
export const PARENTHETICAL_RE = /^\(.+\)$/;
export function isCharacterCue(line: string): boolean {
  return line.length > 0 && line.length <= 40
    && line === line.toUpperCase()
    && /[A-Z]/.test(line)
    && /^[A-Z0-9][A-Z0-9 .'()\-]*$/.test(line)
    && !SCENE_HEADING_RE.test(line);
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const { formats } = await req.json() as { formats: ('docx' | 'md' | 'txt')[] };

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
    with: { chapters: { orderBy: (c, { asc }) => [asc(c.sortOrder)] } },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const getChapterText = (content: string | null): string => {
    if (!content?.trim()) return '';
    if (isValidTipTapJson(content)) return tiptapToPlainText(JSON.parse(content));
    return content;
  };

  const zip = new JSZip();

  if (formats.includes('docx')) {
    const isScreenplay = project.format === 'Screenplay';
    const children: any[] = [];

    children.push(
      new Paragraph({ text: project.name, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: '' }),
    );

    for (const chapter of (project as any).chapters) {
      children.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1 }),
      );

      const text = getChapterText(chapter.content);
      const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim());

      for (const para of paragraphs) {
        const line = para.trim();

        if (!isScreenplay) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line })],
            indent: { firstLine: 720 },
          }));
          continue;
        }

        if (SCENE_HEADING_RE.test(line)) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.toUpperCase(), bold: true })],
            spacing: { before: 240, after: 120 },
          }));
        } else if (isCharacterCue(line)) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.toUpperCase() })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 },
          }));
        } else if (PARENTHETICAL_RE.test(line)) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, italics: true })],
            alignment: AlignmentType.CENTER,
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: line })],
          }));
        }
      }
    }

    const doc = new Document({
      sections: [{ children }],
      styles: {
        paragraphStyles: [{
          id: 'Normal',
          name: 'Normal',
          run: isScreenplay
            ? { font: 'Courier New', size: 24 }
            : { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: isScreenplay ? 240 : 480 } },
        }],
      },
    });

    const buffer = await Packer.toBuffer(doc);
    zip.file(`${project.name}.docx`, buffer);
  }

  if (formats.includes('md')) {
    const lines = [`# ${project.name}\n`];
    for (const chapter of (project as any).chapters) {
      lines.push(`\n## ${chapter.title}\n`);
      lines.push(getChapterText(chapter.content));
    }
    zip.file(`${project.name}.md`, lines.join('\n'));
  }

  if (formats.includes('txt')) {
    const lines = [project.name, '='.repeat(project.name.length), ''];
    for (const chapter of (project as any).chapters) {
      lines.push(chapter.title, '-'.repeat(chapter.title.length), '');
      lines.push(getChapterText(chapter.content), '');
    }
    zip.file(`${project.name}.txt`, lines.join('\n'));
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  await track(session.user.id, 'manuscript_export', { formats: formats.join(',') });
  return new Response(zipBuffer as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_manuscript.zip"`,
    },
  });
}
