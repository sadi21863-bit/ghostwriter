'use client';

import { toast } from '@/lib/toast';

interface Issue {
  type?: string; rule?: string; violation?: string; character?: string;
  entity?: string; state?: string; text?: string; suggestion?: string; severity?: string;
}

export interface QualityReview {
  ruleViolations: Issue[];
  knowledgeViolations: Issue[];
  slopMarkers: Issue[];
  overallSignal: 'strong' | 'acceptable' | 'weak';
  suggestedCanonEvents?: { name: string; description: string }[];
}

interface Props {
  review: QualityReview;
  onDismiss: () => void;
  project?: any;
}

export function QualityReviewPanel({ review, onDismiss, project }: Props) {

  const handleAddCanonEvent = async (ev: { name: string; description: string }) => {
    const universeId = project?.universeId;
    if (!universeId) return;
    try {
      const res = await fetch(`/api/universes/${universeId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ev.name,
          description: ev.description,
          projectId: project?.id,
          timelineSort: Date.now(),
          isCanon: true,
        }),
      });
      if (res.ok) {
        toast.success(`"${ev.name}" added to universe canon`);
      }
    } catch {
      toast.error('Failed to add canon event');
    }
  };
  const totalIssues = review.ruleViolations.length +
    review.knowledgeViolations.length +
    review.slopMarkers.length;

  if (totalIssues === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 360, zIndex: 500,
      background: 'var(--card, #1a1a2e)', border: '1px solid var(--border, #2a2a3e)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border, #2a2a3e)',
        background: review.ruleViolations.length > 0 ? '#451a1a' : 'var(--surface, #16213e)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          Quality Review · {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'}
        </span>
        <button onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto', padding: '8px 0' }}>

        {review.ruleViolations.map((v, i) => (
          <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border, #2a2a3e)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: '2px 6px', background: '#f87171', color: '#fff', borderRadius: 4, fontWeight: 700 }}>Rule violation</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Rule: {v.rule}</div>
            <div style={{ fontSize: 12, color: '#e5e7eb' }}>{v.violation}</div>
          </div>
        ))}

        {review.knowledgeViolations.map((v, i) => (
          <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border, #2a2a3e)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: '2px 6px', background: '#f97316', color: '#fff', borderRadius: 4, fontWeight: 700 }}>Knowledge violation</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
              {v.character} is {v.state} about {v.entity}
            </div>
            <div style={{ fontSize: 12, color: '#e5e7eb' }}>{v.violation}</div>
          </div>
        ))}

        {review.slopMarkers.slice(0, 4).map((s, i) => (
          <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border, #2a2a3e)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: '2px 6px', background: '#ca8a04', color: '#fff', borderRadius: 4, fontWeight: 700 }}>
                {s.type?.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#9ca3af', marginBottom: 2 }}>"{s.text}"</div>
            {s.suggestion && <div style={{ fontSize: 11, color: '#6b7280' }}>→ {s.suggestion}</div>}
          </div>
        ))}

        {review.suggestedCanonEvents && review.suggestedCanonEvents.length > 0 && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border, #2a2a3e)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 8 }}>
              UNIVERSE EVENTS — add to canon?
            </div>
            {review.suggestedCanonEvents.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{ev.description}</div>
                </div>
                <button
                  onClick={() => handleAddCanonEvent(ev)}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4,
                           background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer',
                           flexShrink: 0 }}
                >
                  Add →
                </button>
              </div>
            ))}
          </div>
        )}

        {review.slopMarkers.length > 4 && (
          <div style={{ padding: '6px 14px', fontSize: 11, color: '#6b7280' }}>
            +{review.slopMarkers.length - 4} more slop markers
          </div>
        )}
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border, #2a2a3e)', fontSize: 11, color: '#6b7280' }}>
        Async check — generation presented immediately. Dismiss to ignore.
      </div>
    </div>
  );
}
