'use client';
import { co } from '@/lib/styles';
import { AI_CAPABILITIES } from '@/lib/ai/capabilities';

interface Props {
  project: any;
  characters: any[];
  compact?: boolean;
}

export function CapabilityIndicator({ project, characters, compact = false }: Props) {
  const states = AI_CAPABILITIES.map(cap => ({
    ...cap,
    active: cap.checkFn(project, characters),
  }));

  const activeCount = states.filter(s => s.active).length;
  const totalCount = states.length;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <div style={{
          width: 32, height: 6, borderRadius: 3, background: co.surfaceAlt,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3, background: co.green,
            width: `${(activeCount / totalCount) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ color: co.muted }}>
          {activeCount}/{totalCount} active
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 14px', background: co.surfaceAlt, borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted }}>
          AI INTELLIGENCE ({activeCount}/{totalCount} active)
        </div>
        <div style={{ width: 80, height: 5, borderRadius: 3, background: co.bg }}>
          <div style={{
            height: '100%', borderRadius: 3, background: co.green,
            width: `${(activeCount / totalCount) * 100}%`,
          }} />
        </div>
      </div>

      {states.map(cap => (
        <div key={cap.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          marginBottom: 6, opacity: cap.active ? 1 : 0.55,
        }}>
          <span style={{
            fontSize: 12, flexShrink: 0, marginTop: 1,
            color: cap.active ? co.green : co.muted,
          }}>
            {cap.active ? '✓' : '○'}
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500,
                          color: cap.active ? co.text : co.muted }}>
              {cap.label}
            </div>
            <div style={{ fontSize: 10, color: co.muted }}>{cap.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
