'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  content: string;
  chapterTitle: string;
  projectName: string;
  onContentChange: (v: string) => void;
  onClose: () => void;
}

export function SprintMode({ content, chapterTitle, projectName, onContentChange, onClose }: Props) {
  const [localContent, setLocalContent] = useState(content);
  const [wordCount, setWordCount] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const baselineWords = useRef(content.split(/\s+/).filter(Boolean).length);
  const startTime = useRef(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const wc = content.split(/\s+/).filter(Boolean).length;
    setWordCount(wc);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    const wc = val.split(/\s+/).filter(Boolean).length;
    setWordCount(wc);
    setSessionWords(Math.max(0, wc - baselineWords.current));
    onContentChange(val);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#0d0d10',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Minimal header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, color: '#9898A6' }}>
          {projectName} — {chapterTitle}
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#9898A6', alignItems: 'center' }}>
          <span>{wordCount.toLocaleString()} words</span>
          {sessionWords > 0 && (
            <span style={{ color: '#4ade80' }}>+{sessionWords} this session</span>
          )}
          <span>{formatTime(elapsed)}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9898A6',
                     cursor: 'pointer', fontSize: 12, padding: 0 }}
          >
            Esc to exit
          </button>
        </div>
      </div>

      {/* Writing surface */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        style={{
          flex: 1,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: '#F2F2F3',
          fontSize: 17,
          lineHeight: 1.85,
          fontFamily: 'Georgia, "Times New Roman", serif',
          padding: '48px max(48px, calc((100vw - 680px) / 2))',
          overflowY: 'auto',
        }}
        placeholder="Begin writing..."
        spellCheck
      />
    </div>
  );
}
