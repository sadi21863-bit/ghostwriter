'use client';
import { useState } from 'react';
import { sBtn, sBtnSm } from '@/lib/styles';
import { ALT_DRAFT_GOALS } from '@/lib/alt-draft/goals';
import type { AltDraftGoal, AlternateDraft } from '@/types';

const GOALS: AltDraftGoal[] = ['tighter-prose', 'more-emotional', 'stronger-suspense', 'continuity-repair', 'clearer-prose', 'sharper-dialogue'];

interface Props {
  project: any;
  activeChap: any;
  updateChapter: (field: string, value: any) => void;
  onClose: () => void;
}

export function AltDraftPanel({ project, activeChap, updateChapter, onClose }: Props) {
  const [selectedGoal, setSelectedGoal] = useState<AltDraftGoal>('tighter-prose');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState<AlternateDraft | null>(null);

  const existingDrafts: AlternateDraft[] = (activeChap?.alternateDrafts as any) ?? [];

  const generate = async () => {
    if (!activeChap?.id || !activeChap?.content?.trim()) {
      setError('Open a chapter with content first.');
      return;
    }
    setGenerating(true); setError('');
    try {
      const res = await fetch(`/api/projects/${project.id}/chapters/${activeChap.id}/alt-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: selectedGoal }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const newDrafts = [...existingDrafts, data.draft].slice(-5);
      updateChapter('alternateDrafts', newDrafts);
    } catch { setError('Generation failed. Try again.'); }
    setGenerating(false);
  };

  const useDraft = (draft: AlternateDraft) => {
    updateChapter('content', draft.content);
    setComparing(null);
  };

  const discardDraft = (draftId: string) => {
    const updated = existingDrafts.filter(d => d.id !== draftId);
    updateChapter('alternateDrafts', updated);
    if (comparing?.id === draftId) setComparing(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#18181B', borderRadius: 14, width: 900, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F2F2F3' }}>Alternate Draft</div>
            <div style={{ fontSize: 12, color: '#9898A6', marginTop: 2, fontStyle: 'italic' }}>
              A parallel perspective — not an improvement. You decide what's better.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9898A6', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {comparing ? (
          /* Compare view */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F2F2F3' }}>
                Comparing: {ALT_DRAFT_GOALS[comparing.goal].label}
              </span>
              <button onClick={() => setComparing(null)} style={{ ...sBtnSm }}>Back to list</button>
            </div>
            {comparing.intent && (
              <div style={{ padding: '8px 12px', background: 'rgba(217,119,6,0.1)', borderRadius: 8, fontSize: 12, color: '#fbbf24', marginBottom: 10, borderLeft: '3px solid #d97706' }}>
                <strong>What changed:</strong> {comparing.intent}
              </div>
            )}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, color: '#9898A6', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Original</div>
                <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia,serif', color: '#F2F2F3', padding: '10px 12px', background: '#111113', borderRadius: 8 }}>
                  {activeChap?.content}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, color: '#9898A6', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Alternate — {comparing.wordCount} words
                </div>
                <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia,serif', color: '#F2F2F3', padding: '10px 12px', background: '#111113', borderRadius: 8 }}>
                  {comparing.content}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => discardDraft(comparing.id)} style={sBtnSm}>Discard</button>
              <button onClick={() => useDraft(comparing)} style={sBtn}>Use This Draft</button>
            </div>
          </div>
        ) : (
          /* Main view */
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {/* Goal selector */}
            <div style={{ fontSize: 12, color: '#9898A6', marginBottom: 10 }}>Select a goal for the alternate draft:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {GOALS.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGoal(g)}
                  style={{
                    padding: '10px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                    border: `1px solid ${selectedGoal === g ? '#D97706' : 'rgba(255,255,255,0.1)'}`,
                    background: selectedGoal === g ? 'rgba(217,119,6,0.1)' : 'transparent',
                    color: selectedGoal === g ? '#D97706' : '#9898A6',
                    fontWeight: selectedGoal === g ? 600 : 400,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{ALT_DRAFT_GOALS[g].label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={generate}
              disabled={generating}
              style={{ ...sBtn, width: '100%', opacity: generating ? 0.5 : 1, marginBottom: 16 }}
            >
              {generating ? 'Generating alternate draft...' : 'Generate Alternate Draft'}
            </button>

            {error && (
              <div style={{ padding: '8px 12px', background: '#2a1010', borderRadius: 8, color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>
            )}

            {/* Existing drafts */}
            {existingDrafts.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#9898A6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  Saved Drafts ({existingDrafts.length}/5)
                </div>
                {existingDrafts.map(draft => (
                  <div
                    key={draft.id}
                    style={{ padding: '10px 14px', background: '#111113', borderRadius: 8, marginBottom: 8, border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#F2F2F3' }}>{ALT_DRAFT_GOALS[draft.goal]?.label}</span>
                        <span style={{ fontSize: 11, color: '#9898A6', marginLeft: 10 }}>
                          {draft.wordCount} words · {new Date(draft.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button onClick={() => setComparing(draft)} style={sBtnSm}>Compare</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
