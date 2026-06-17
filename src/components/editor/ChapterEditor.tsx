'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { isValidTipTapJson, plainTextToTipTap, getWordCount } from '@/lib/editor/content-migration';
import { FormatToolbar } from './FormatToolbar';

interface Props {
  content: string;
  onChange: (json: string, wordCount: number) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

export interface ChapterEditorHandle {
  insertContent: (text: string) => void;
}

export const ChapterEditor = forwardRef<ChapterEditorHandle, Props>(function ChapterEditor(
  { content, onChange, placeholder, readOnly, autoFocus }, ref
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const getInitialContent = () => {
    if (!content?.trim()) return { type: 'doc', content: [{ type: 'paragraph' }] };
    if (isValidTipTapJson(content)) return JSON.parse(content);
    return plainTextToTipTap(content);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Begin writing...' }),
      CharacterCount,
      Typography,
      Focus.configure({ className: 'has-focus', mode: 'deepest' }),
      Highlight.configure({ multicolor: true }),
      Underline,
    ],
    content: getInitialContent(),
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const wc = getWordCount(editor.getJSON());

      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onChange(json, wc);
      }, 1500);
    },
  });

  useImperativeHandle(ref, () => ({
    insertContent: (text: string) => {
      if (!editor) return;
      const nodes = (plainTextToTipTap(text) as any).content ?? [];
      editor.commands.insertContentAt(editor.state.doc.content.size, nodes);
    },
  }), [editor]);

  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const targetContent = content?.trim()
      ? (isValidTipTapJson(content) ? content : JSON.stringify(plainTextToTipTap(content)))
      : JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });

    if (currentJson !== targetContent) {
      editor.commands.setContent(JSON.parse(targetContent));
    }
  }, [content, editor]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return (
    <div className="chapter-editor" style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <FormatToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
});
