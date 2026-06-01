'use client';
import { useState, useEffect, useRef } from 'react';
import { ChapterEditor } from '@/components/editor/ChapterEditor';
import { getWordCount } from '@/lib/editor/content-migration';

interface Props {
  content: string;
  chapterTitle: string;
  projectName: string;
  onContentChange: (v: string) => void;
  onClose: () => void;
}

export function SprintMode({ content, chapterTitle, projectName, onContentChange, onClose }: Props) {
  const [wordCount, setWordCount] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const baselineWords = useRef(getWordCount(content));

  useEffect(() => {
    setWordCount(getWordCount(content));
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

  const handleChange = (json: string, wc: number) => {
    setWordCount(wc);
    setSessionWords(Math.max(0, wc - baselineWords.current));
    onContentChange(json);
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
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ChapterEditor
          content={content}
          onChange={handleChange}
          placeholder="Begin writing..."
          autoFocus
        />
      </div>
    </div>
  );
}
