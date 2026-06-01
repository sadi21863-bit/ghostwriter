'use client';
import { useEffect, useState, useRef } from 'react';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
}

export function FormatToolbar({ editor }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { from, to } = editor.state.selection;
      if (from === to) { setPos(null); return; }

      const domRect = editor.view.coordsAtPos(from);
      setPos({ top: domRect.top - 48 + window.scrollY, left: domRect.left });
    };

    editor.on('selectionUpdate', update);
    return () => { editor.off('selectionUpdate', update); };
  }, [editor]);

  if (!pos || !editor) return null;

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 8px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
    background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.75)',
    fontWeight: active ? 700 : 400,
  });

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000,
        background: '#1a1a22', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, padding: '4px 6px', display: 'flex', gap: 2,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <button style={btn(editor.isActive('bold'))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>B</button>
      <button style={{ ...btn(editor.isActive('italic')), fontStyle: 'italic' }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>I</button>
      <button style={{ ...btn(editor.isActive('underline')), textDecoration: 'underline' }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}>U</button>
      <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 4px' }} />
      <button style={btn(editor.isActive('heading', { level: 1 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}>H1</button>
      <button style={btn(editor.isActive('heading', { level: 2 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}>H2</button>
      <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 4px' }} />
      <button style={btn(editor.isActive('blockquote'))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}>❝</button>
      <button style={btn(editor.isActive('highlight'))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }}>H</button>
    </div>
  );
}
