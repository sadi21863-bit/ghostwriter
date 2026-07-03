'use client';
import { useState, useEffect, useRef } from 'react';
import { ChapterEditor } from '@/components/editor/ChapterEditor';
import { getWordCount } from '@/lib/editor/content-migration';
import { panel, sBtn } from '@/lib/styles';

interface Props {
  content: string;
  chapterTitle: string;
  projectName: string;
  onContentChange: (v: string) => void;
  onClose: () => void;
}

const PRESET_GOALS = [250, 500, 1000] as const;

export function SprintMode({ content, chapterTitle, projectName, onContentChange, onClose }: Props) {
  const [wordCount, setWordCount] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [goal, setGoal] = useState(500);
  const [customGoal, setCustomGoal] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [goalReached, setGoalReached] = useState(false);
  const startTime = useRef(Date.now());
  const baselineWords = useRef(getWordCount(content));

  // Sprint is "locked in" once the user has typed the first word
  const goalLocked = sessionWords > 0;

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
    const session = Math.max(0, wc - baselineWords.current);
    setSessionWords(session);
    if (!goalReached && session >= goal) {
      setGoalReached(true);
    }
    onContentChange(json);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = Math.min(100, goal > 0 ? (sessionWords / goal) * 100 : 0);

  const handleCustomGoalCommit = () => {
    const parsed = parseInt(customGoal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setGoal(parsed);
    }
    setShowCustom(false);
    setCustomGoal('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: panel.deeper,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Minimal header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, color: panel.muted }}>
          {projectName} — {chapterTitle}
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: panel.muted, alignItems: 'center' }}>
          <span>{wordCount.toLocaleString()} words</span>
          <span>{formatTime(elapsed)}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: panel.muted,
                     cursor: 'pointer', fontSize: 12, padding: 0 }}
          >
            Esc to exit
          </button>
        </div>
      </div>

      {/* Goal bar */}
      <div style={{
        padding: '10px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
        background: panel.deeper,
      }}>
        {/* Goal selector (locked once writing starts) */}
        {!goalLocked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: panel.muted, marginRight: 4 }}>Goal:</span>
            {PRESET_GOALS.map((g) => (
              <button
                key={g}
                onClick={() => { setGoal(g); setShowCustom(false); setCustomGoal(''); }}
                style={{
                  background: goal === g ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                  border: goal === g ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  color: goal === g ? '#c4b5fd' : panel.muted,
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '2px 8px',
                  transition: 'all 0.15s',
                }}
              >
                {g}
              </button>
            ))}
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                style={{
                  background: !PRESET_GOALS.includes(goal as typeof PRESET_GOALS[number]) ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                  border: !PRESET_GOALS.includes(goal as typeof PRESET_GOALS[number]) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  color: !PRESET_GOALS.includes(goal as typeof PRESET_GOALS[number]) ? '#c4b5fd' : panel.muted,
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '2px 8px',
                }}
              >
                {!PRESET_GOALS.includes(goal as typeof PRESET_GOALS[number]) ? `${goal} ✎` : 'Custom'}
              </button>
            ) : (
              <input
                type="number"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomGoalCommit();
                  if (e.key === 'Escape') { setShowCustom(false); setCustomGoal(''); }
                }}
                onBlur={handleCustomGoalCommit}
                placeholder="e.g. 750"
                autoFocus
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: 4,
                  color: panel.text,
                  fontSize: 11,
                  padding: '2px 8px',
                  width: 72,
                  outline: 'none',
                }}
              />
            )}
          </div>
        ) : null}

        {/* Progress row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Progress bar */}
          <div style={{
            flex: 1,
            height: 4,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: goalReached
                ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                : progress >= 75
                  ? 'linear-gradient(90deg, #8b5cf6, #a78bfa)'
                  : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: 2,
              transition: 'width 0.4s ease, background 0.4s ease',
            }} />
          </div>

          {/* Word count vs goal */}
          <span style={{ fontSize: 11, color: goalReached ? panel.success : panel.muted, whiteSpace: 'nowrap', minWidth: 90, textAlign: 'right' }}>
            {sessionWords} / {goal} words
          </span>
        </div>

        {/* Completion celebration */}
        {goalReached && (
          <div style={{
            marginTop: 8,
            padding: '6px 12px',
            background: `color-mix(in srgb, ${panel.success} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${panel.success} 20%, transparent)`,
            borderRadius: 6,
            fontSize: 12,
            color: panel.success,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>🎉</span>
            <span>
              Goal reached! {sessionWords} words in {formatTime(elapsed)} — keep going if you&apos;re in the flow.
            </span>
          </div>
        )}
        {goalReached && (
          <button
            onClick={() => {
              setSessionWords(0);
              setGoalReached(false);
              setElapsed(0);
              startTime.current = Date.now();
              baselineWords.current = getWordCount(content);
            }}
            style={{ ...sBtn, fontSize: 12, marginTop: 6, width: '100%' }}
          >
            Start New Sprint
          </button>
        )}
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
