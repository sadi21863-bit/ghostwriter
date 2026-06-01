import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from 'docx';
import { tiptapToPlainText, isValidTipTapJson } from '@/lib/editor/content-migration';
import { track } from '@/lib/analytics';

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();
  const { formats } = await req.json() as { formats: ('docx' | 'md' | 'txt')[] };

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
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
        children.push(new Paragraph({
          children: [new TextRun({ text: para.trim() })],
          indent: { firstLine: 720 },
        }));
      }
    }

    const doc = new Document({
      sections: [{ children }],
      styles: {
        paragraphStyles: [{
          id: 'Normal',
          name: 'Normal',
          run: { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: 480 } },
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
