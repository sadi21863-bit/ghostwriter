"use client";
import { useState } from "react";
import { isStoryFormat } from "@/lib/formats";

interface ExportPanelProps {
  projectId: string;
  projectFormat?: string;
  onClose: () => void;
}

type ManuscriptFormat = 'docx' | 'md' | 'txt';
type SerialPlatform = 'generic' | 'wattpad' | 'royalroad' | 'substack';

export function ExportPanel({ projectId, projectFormat = 'Novel', onClose }: ExportPanelProps) {
  const isStory = isStoryFormat(projectFormat);
  const [tab, setTab] = useState<"manuscript" | "query-letter" | "blurb" | "web-serial">("manuscript");

  // Manuscript state
  const [selectedFormats, setSelectedFormats] = useState<ManuscriptFormat[]>(['docx']);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Web serial state
  const [serialPlatform, setSerialPlatform] = useState<SerialPlatform>('generic');
  const [exportingSerial, setExportingSerial] = useState(false);
  const [serialError, setSerialError] = useState("");

  // Query Letter state
  const [targetAgent, setTargetAgent] = useState("");
  const [generatingQL, setGeneratingQL] = useState(false);
  const [queryLetter, setQueryLetter] = useState("");
  const [qlError, setQlError] = useState("");
  const [qlCopied, setQlCopied] = useState(false);

  // Blurb state
  const [generatingBlurb, setGeneratingBlurb] = useState(false);
  const [blurb, setBlurb] = useState("");
  const [taglines, setTaglines] = useState<string[]>([]);
  const [blurbError, setBlurbError] = useState("");
  const [blurbCopied, setBlurbCopied] = useState(false);

  const handleExport = async () => {
    setExporting(true); setExportError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/export/manuscript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats: selectedFormats }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFormats.length === 1
        ? `manuscript.${selectedFormats[0]}`
        : 'manuscript.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch { setExportError('Export failed. Try again.'); }
    setExporting(false);
  };

  const handleEpisodePack = async () => {
    setExportingSerial(true); setSerialError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/export/episode-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: serialPlatform }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'episode_pack.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch { setSerialError('Export failed. Try again.'); }
    setExportingSerial(false);
  };

  const generateQueryLetter = async () => {
    setGeneratingQL(true); setQlError(""); setQueryLetter("");
    try {
      const res = await fetch(`/api/projects/${projectId}/export/query-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAgent }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setQlError("Upgrade to Story Pro to use Export."); }
      else if (data.error) { setQlError(data.error); }
      else { setQueryLetter(data.queryLetter); }
    } catch { setQlError("Generation failed. Try again."); }
    setGeneratingQL(false);
  };

  const generateBlurb = async () => {
    setGeneratingBlurb(true); setBlurbError(""); setBlurb(""); setTaglines([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/blurb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setBlurbError("Upgrade to Story Pro to use Export."); }
      else if (data.error) { setBlurbError(data.error); }
      else { setBlurb(data.blurb); setTaglines(data.taglines || []); }
    } catch { setBlurbError("Generation failed. Try again."); }
    setGeneratingBlurb(false);
  };

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  const darkInput: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border-default)",
    background: "var(--color-bg-editor)", color: "var(--color-text-primary)", fontSize: 13, boxSizing: "border-box",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? "var(--color-bg-elevated)" : "transparent", color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
  });

  const sBtnPrimary = (loading: boolean, color = "var(--color-accent)"): React.CSSProperties => ({
    padding: "9px 18px", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer",
    background: loading ? "#333" : color, color: "var(--color-accent-fg)", fontSize: 13, fontWeight: 500,
  });

  const errorBox = (msg: string) => msg ? (
    <div style={{ padding: "10px 14px", background: "#2a1010", borderRadius: 8, color: "#f87171", fontSize: 13, marginTop: 12 }}>{msg}</div>
  ) : null;

  const tabs = [
    { id: "manuscript" as const, label: "Manuscript" },
    // Query Letter / Back-Cover Blurb are literary-publishing concepts that
    // don't apply to creator formats (YouTube/TikTok/Podcast scripts) — only
    // offer them for story formats (Novel/Screenplay/Web Series).
    ...(isStory ? [{ id: "query-letter" as const, label: "Query Letter" }, { id: "blurb" as const, label: "Back-Cover Blurb" }] : []),
    ...(isStory && projectFormat === 'Web Series' ? [{ id: "web-serial" as const, label: "Web Serial" }] : []),
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
      <div style={{ background: "var(--color-bg-surface)", borderRadius: 14, width: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid var(--color-border-default)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>Export & Publishing</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Generate professional publishing materials from your project</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "14px 20px 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* ── Manuscript ── */}
          {tab === "manuscript" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
                Export your full manuscript. Select formats:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {([
                  { id: 'docx' as const, label: 'Word Document (.docx)', desc: 'Standard manuscript format, double-spaced' },
                  { id: 'md' as const,   label: 'Markdown (.md)',        desc: 'Clean prose, chapter headings, portable' },
                  { id: 'txt' as const,  label: 'Plain text (.txt)',     desc: 'Maximum compatibility' },
                ]).map(fmt => (
                  <label key={fmt.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedFormats.includes(fmt.id)}
                      onChange={e => setSelectedFormats(prev =>
                        e.target.checked ? [...prev, fmt.id] : prev.filter(f => f !== fmt.id)
                      )}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{fmt.label}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{fmt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={handleExport}
                disabled={selectedFormats.length === 0 || exporting}
                style={sBtnPrimary(exporting)}
              >
                {exporting ? 'Generating...' : `Export ${selectedFormats.length > 1 ? 'as ZIP' : selectedFormats[0]?.toUpperCase()}`}
              </button>
              {errorBox(exportError)}
              <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 12 }}>
                PDF: use your browser&apos;s Print → Save as PDF for formatted output.
              </p>
            </div>
          )}

          {/* ── Web Serial ── */}
          {tab === "web-serial" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
                Export an episode pack for web serial publishing.
              </p>
              <label style={{ fontSize: 13, marginBottom: 8, display: 'block', color: "var(--color-text-primary)" }}>Platform:</label>
              <select
                value={serialPlatform}
                onChange={e => setSerialPlatform(e.target.value as SerialPlatform)}
                style={{ ...darkInput, marginBottom: 12, cursor: 'pointer' }}
              >
                <option value="generic">Generic</option>
                <option value="wattpad">Wattpad</option>
                <option value="royalroad">Royal Road</option>
                <option value="substack">Substack</option>
              </select>
              <button onClick={handleEpisodePack} disabled={exportingSerial} style={sBtnPrimary(exportingSerial)}>
                {exportingSerial ? 'Generating...' : 'Export Episode Pack'}
              </button>
              {errorBox(serialError)}
            </div>
          )}

          {/* ── Query Letter ── */}
          {tab === "query-letter" && (
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 14px" }}>
                Industry-standard query letter generated from your project data. Target a specific agent to personalise the opening.
              </p>
              <input
                value={targetAgent}
                onChange={e => setTargetAgent(e.target.value)}
                placeholder="Target agent name (optional — e.g. Janet Reid, Joanna Volpe)"
                style={{ ...darkInput, marginBottom: 12 }}
              />
              <button onClick={generateQueryLetter} disabled={generatingQL} style={sBtnPrimary(generatingQL)}>
                {generatingQL ? "Generating…" : "Generate Query Letter"}
              </button>
              {errorBox(qlError)}
              {queryLetter && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <button onClick={() => copy(queryLetter, setQlCopied)} style={{ padding: "6px 14px", borderRadius: 6, background: qlCopied ? "#22c55e" : "var(--color-bg-elevated)", border: "none", color: "var(--color-text-primary)", fontSize: 12, cursor: "pointer" }}>
                      {qlCopied ? "✓ Copied" : "Copy to Clipboard"}
                    </button>
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, color: "var(--color-text-primary)", background: "var(--color-bg-editor)", padding: "16px", borderRadius: 8, margin: 0 }}>
                    {queryLetter}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── Blurb ── */}
          {tab === "blurb" && (
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 14px" }}>
                150-word back-cover blurb + 3 tagline variants using genre-specific blurb conventions.
              </p>
              <button onClick={generateBlurb} disabled={generatingBlurb} style={sBtnPrimary(generatingBlurb)}>
                {generatingBlurb ? "Generating…" : "Generate Blurb & Taglines"}
              </button>
              {errorBox(blurbError)}
              {blurb && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Back-Cover Blurb</div>
                    <button onClick={() => copy(blurb, setBlurbCopied)} style={{ padding: "6px 14px", borderRadius: 6, background: blurbCopied ? "#22c55e" : "var(--color-bg-elevated)", border: "none", color: "var(--color-text-primary)", fontSize: 12, cursor: "pointer" }}>
                      {blurbCopied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ background: "var(--color-bg-editor)", padding: "14px 16px", borderRadius: 8, fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary)", marginBottom: 16 }}>
                    {blurb}
                  </div>
                  {taglines.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Taglines</div>
                      {taglines.map((t, i) => (
                        <div key={i} style={{ padding: "10px 14px", background: "var(--color-bg-editor)", borderRadius: 8, marginBottom: 6, fontSize: 13, color: "var(--color-text-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontStyle: "italic" }}>{t}</span>
                          <button onClick={() => navigator.clipboard.writeText(t)} style={{ padding: "4px 10px", borderRadius: 5, background: "var(--color-bg-elevated)", border: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer", flexShrink: 0, marginLeft: 12 }}>
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
