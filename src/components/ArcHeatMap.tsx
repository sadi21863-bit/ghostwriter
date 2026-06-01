'use client';
import { useEffect, useState } from 'react';

interface HeatMapData {
  characters: { id: string; name: string }[];
  chapters: { id: string; title: string }[];
  presence: boolean[][];
}

interface Props { projectId: string; }

export function ArcHeatMap({ projectId }: Props) {
  const [data, setData] = useState<HeatMapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/arc-heatmap`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ color: '#9898A6', padding: 24, fontSize: 13 }}>Scanning chapters...</div>;
  if (!data) return null;
  if (data.characters.length === 0) return <div style={{ color: '#9898A6', padding: 24, fontSize: 13 }}>No characters found. Add characters to your World Bible first.</div>;
  if (data.chapters.length === 0) return <div style={{ color: '#9898A6', padding: 24, fontSize: 13 }}>No chapters found. Add chapters first.</div>;

  const { characters, chapters, presence } = data;

  const getAbsenceStreak = (charIdx: number): number => {
    let maxStreak = 0, current = 0;
    for (let c = 0; c < chapters.length; c++) {
      if (!presence[c][charIdx]) { current++; maxStreak = Math.max(maxStreak, current); }
      else current = 0;
    }
    return maxStreak;
  };

  return (
    <div style={{ overflowX: 'auto', padding: '0 4px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#F2F2F3', marginBottom: 12 }}>Character Arc Heat Map</h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `140px repeat(${chapters.length}, 28px)`,
        gap: 2,
        minWidth: 'max-content',
      }}>
        {/* Header row — chapter numbers */}
        <div />
        {chapters.map((_, i) => (
          <div key={i} style={{
            fontSize: 9, color: '#9898A6', textAlign: 'center',
            height: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            paddingBottom: 4,
            writingMode: 'horizontal-tb',
          }}>
            {i + 1}
          </div>
        ))}

        {/* Character rows */}
        {characters.map((char, ci) => {
          const streak = getAbsenceStreak(ci);
          const nameColor = streak >= 5 ? '#f87171' : streak >= 3 ? '#facc15' : '#F2F2F3';
          return [
            <div key={`name-${ci}`} style={{
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
              color: nameColor, fontWeight: streak >= 3 ? 600 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              paddingRight: 8,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{char.name}</span>
              {streak >= 3 && (
                <span style={{ fontSize: 9, color: nameColor, flexShrink: 0 }}>
                  {streak}ch
                </span>
              )}
            </div>,
            ...chapters.map((chap, chi) => (
              <div
                key={`cell-${ci}-${chi}`}
                title={`${char.name} in "${chap.title}": ${presence[chi][ci] ? 'present' : 'absent'}`}
                style={{
                  width: 26, height: 26, borderRadius: 4,
                  background: presence[chi]?.[ci] ? '#4ade80' : 'rgba(255,255,255,0.06)',
                }}
              />
            )),
          ];
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#9898A6', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} />
          Present
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.06)', display: 'inline-block' }} />
          Absent
        </span>
        <span style={{ color: '#facc15' }}>Yellow name = 3–4 chapter absence streak</span>
        <span style={{ color: '#f87171' }}>Red name = 5+ chapter absence streak</span>
      </div>
    </div>
  );
}
