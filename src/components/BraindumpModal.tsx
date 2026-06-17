"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface BraindumpResult {
  projectName: string; premise: string; format: string; genres: string[];
  controllingIdea: string; characters: Array<{ name: string; role: string; description: string }>;
  worldFacts: string[]; openConflicts: string[]; suggestedTitle: string;
}

const GW_GOLD = "#c9a84c";
const GW_BORDER = "#ede9df";

const inputS: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid " + GW_BORDER,
  borderRadius: 10, fontSize: 13, color: "#1a1a1a", outline: "none", boxSizing: "border-box",
  fontFamily: "'Figtree', sans-serif",
};

interface BraindumpModalProps {
  onClose: () => void;
}

export default function BraindumpModal({ onClose }: BraindumpModalProps) {
  const router = useRouter();
  const [braindumpText, setBraindumpText] = useState("");
  const [braindumpProcessing, setBraindumpProcessing] = useState(false);
  const [braindumpResult, setBraindumpResult] = useState<BraindumpResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleProcessBraindump = async () => {
    if (braindumpText.trim().length < 50) return;
    setBraindumpProcessing(true);
    setError("");
    try {
      const res = await fetch('/api/ai/braindump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: braindumpText }),
      });
      const data = await res.json();
      if (data.result) setBraindumpResult(data.result);
      else setError(data.error || 'Could not process braindump');
    } catch {
      setError('Processing failed. Please try again.');
    } finally {
      setBraindumpProcessing(false);
    }
  };

  const handleCreateFromBraindump = async () => {
    if (!braindumpResult) return;
    setCreating(true);
    try {
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: braindumpResult.projectName,
          format: braindumpResult.format,
          genres: braindumpResult.genres,
          storyType: 'linear',
        }),
      });
      if (!projRes.ok) throw new Error('Failed to create project');
      const proj = await projRes.json();

      await fetch(`/api/projects/${proj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: braindumpResult.genres,
          controllingIdea: braindumpResult.controllingIdea,
        }),
      });

      await Promise.all(braindumpResult.characters.map(char =>
        fetch(`/api/projects/${proj.id}/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: char.name,
            role: char.role,
            personality: char.description,
          }),
        })
      ));

      await Promise.all(braindumpResult.worldFacts.map(fact =>
        fetch(`/api/projects/${proj.id}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fact.length > 50 ? fact.substring(0, 50) : fact,
            description: fact,
          }),
        })
      ));

      router.push(`/project/${proj.id}`);
    } catch {
      setError('Failed to create project. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>New story</div>

        {!braindumpResult && (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
              Write anything you know about your story. Don&apos;t organize it — fragments, character
              names, scenes you imagine, themes, contradictions. The messier the better.
            </div>
            <textarea
              value={braindumpText}
              onChange={e => setBraindumpText(e.target.value)}
              placeholder="e.g. A detective in 1920s Bombay who solves murders but is secretly haunted by his own past crime. Something about monsoon season. The villain might be a woman — no, definitely a woman, charming and ruthless. There's a train. The detective has a bad leg. He drinks too much. A young journalist keeps interfering..."
              rows={8}
              style={{ ...inputS, resize: 'vertical', fontFamily: "'Figtree', sans-serif" }}
            />
            {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{error}</div>}
            <button
              type="button"
              onClick={handleProcessBraindump}
              disabled={braindumpText.trim().length < 50 || braindumpProcessing}
              className="gw-gold-btn"
              style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                       background: GW_GOLD, color: '#0d0d10', border: 'none',
                       cursor: braindumpText.trim().length < 50 ? 'default' : 'pointer',
                       opacity: braindumpText.trim().length < 50 ? 0.5 : 1,
                       fontSize: 13, fontWeight: 700, fontFamily: "'Figtree', sans-serif" }}
            >
              {braindumpProcessing ? 'Organizing your ideas...' : 'Organize into a project →'}
            </button>
            <button type="button" onClick={onClose}
              style={{ marginTop: 8, width: '100%', border: '1px solid ' + GW_BORDER, background: '#fff', color: '#888', fontWeight: 600, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              Cancel
            </button>
          </div>
        )}

        {braindumpResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d9e75' }}>
              ✓ Found your story — review before creating:
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Project name</label>
              <input
                value={braindumpResult.projectName}
                onChange={e => setBraindumpResult({ ...braindumpResult, projectName: e.target.value })}
                style={inputS}
              />
            </div>

            <div style={{ padding: '8px 12px', background: '#f5f4f0', borderRadius: 8,
                          fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              {braindumpResult.premise}
            </div>

            {braindumpResult.characters.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Characters found ({braindumpResult.characters.length})
                </div>
                {braindumpResult.characters.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '6px 10px', color: '#555',
                                        background: '#f5f4f0', borderRadius: 6, marginBottom: 4 }}>
                    <strong>{c.name}</strong> ({c.role}) — {c.description}
                  </div>
                ))}
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setBraindumpResult(null)}
                style={{ flex: 1, border: '1px solid ' + GW_BORDER, background: '#fff', color: '#888', fontWeight: 600, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}
              >
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleCreateFromBraindump}
                disabled={creating}
                className="gw-gold-btn"
                style={{ flex: 2, background: GW_GOLD, color: '#0d0d10', border: 'none', fontWeight: 700, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}
              >
                {creating ? 'Creating…' : 'Create project →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
