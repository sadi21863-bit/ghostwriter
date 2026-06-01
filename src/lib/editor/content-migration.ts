export function isValidTipTapJson(content: string): boolean {
  if (!content?.trim()) return false;
  try {
    const parsed = JSON.parse(content);
    return parsed?.type === 'doc' && Array.isArray(parsed?.content);
  } catch {
    return false;
  }
}

export function plainTextToTipTap(text: string): object {
  if (!text?.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .flatMap(block => {
      const lines = block.split('\n').filter(l => l.trim());
      if (lines.length === 0) return [];
      return [{
        type: 'paragraph',
        content: lines.flatMap((line, i) => {
          const textNode = { type: 'text', text: line };
          return i < lines.length - 1
            ? [textNode, { type: 'hardBreak' }]
            : [textNode];
        }),
      }];
    });

  return {
    type: 'doc',
    content: paragraphs.length > 0
      ? paragraphs
      : [{ type: 'paragraph' }],
  };
}

export function tiptapToPlainText(tiptapJson: object): string {
  const doc = tiptapJson as any;
  if (!doc?.content) return '';

  function nodeToText(node: any): string {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'paragraph') {
      const inner = (node.content ?? []).map(nodeToText).join('');
      return inner + '\n\n';
    }
    if (node.type === 'heading') {
      const inner = (node.content ?? []).map(nodeToText).join('');
      return inner + '\n\n';
    }
    if (node.content) return (node.content as any[]).map(nodeToText).join('');
    return '';
  }

  return doc.content.map(nodeToText).join('').trimEnd();
}

export function getWordCount(tiptapJson: object | string): number {
  const text = typeof tiptapJson === 'string'
    ? (isValidTipTapJson(tiptapJson) ? tiptapToPlainText(JSON.parse(tiptapJson)) : tiptapJson)
    : tiptapToPlainText(tiptapJson);
  return text.trim().split(/\s+/).filter(Boolean).length;
}
