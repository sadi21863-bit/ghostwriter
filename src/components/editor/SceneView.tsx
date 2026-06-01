'use client';
import { useState } from 'react';
import { ChapterEditor } from './ChapterEditor';
import { SCENE_PURPOSES } from '@/lib/arc';
import { EMOTIONAL_TONES } from '@/lib/arc';
import { getWordCount } from '@/lib/editor/content-migration';
import type { Scene, ScenePurpose } from '@/types';

interface Props {
  scenes: Scene[];
  characters: { id: string; name: string }[];
  onScenesChange: (scenes: Scene[]) => void;
}

export function SceneView({ scenes, characters, onScenesChange }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);

  const addScene = () => {
    const newScene: Scene = {
      id: crypto.randomUUID(),
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
      purpose: 'plot-advance',
      pov: '',
      emotionalTone: '',
      sortOrder: scenes.length,
      createdAt: new Date().toISOString(),
    };
    onScenesChange([...scenes, newScene]);
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    onScenesChange(scenes.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteScene = (id: string) => {
    onScenesChange(scenes.filter(s => s.id !== id));
  };

  const metaSelectStyle: React.CSSProperties = {
    fontSize: 11, padding: '3px 6px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      {scenes
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((scene, idx) => (
          <div
            key={scene.id}
            className="scene-card"
            draggable
            onDragStart={() => setDragging(scene.id)}
            onDragEnd={() => setDragging(null)}
            style={{ opacity: dragging === scene.id ? 0.5 : 1 }}
          >
            <div className="scene-meta-bar">
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>
                Scene {idx + 1}
              </span>

              <select
                value={scene.purpose}
                onChange={e => updateScene(scene.id, { purpose: e.target.value as ScenePurpose })}
                style={metaSelectStyle}
              >
                {Object.entries(SCENE_PURPOSES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <select
                value={scene.pov}
                onChange={e => updateScene(scene.id, { pov: e.target.value })}
                style={metaSelectStyle}
              >
                <option value="">POV...</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={scene.emotionalTone}
                onChange={e => updateScene(scene.id, { emotionalTone: e.target.value })}
                style={metaSelectStyle}
              >
                <option value="">Tone...</option>
                {EMOTIONAL_TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
                {getWordCount(scene.content)} words
              </span>

              <button
                onClick={() => deleteScene(scene.id)}
                title="Delete scene"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
              >
                ×
              </button>
            </div>

            <ChapterEditor
              content={scene.content}
              onChange={(json) => updateScene(scene.id, { content: json })}
              placeholder={`Scene ${idx + 1} — begin writing...`}
            />
          </div>
        ))}

      <button className="add-scene-btn" onClick={addScene}>+ Add Scene</button>
    </div>
  );
}
