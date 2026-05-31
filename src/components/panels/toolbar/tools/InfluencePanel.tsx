"use client";
import { useState, useEffect } from "react";

const BG      = "#1a1a20";
const SURFACE = "#22222c";
const BORDER  = "#2a2a35";
const TEXT     = "#e8e8e8";
const MUTED    = "#888";
const ACCENT   = "#5b4ccc";
const GREEN    = "#2d9e5e";
const AMBER    = "#c9860a";

interface InfluencePanelProps {
  activeInfluence: any | null;
  setActiveInfluence: (p: any | null) => void;
  activePatterns: any[];
  setActivePatterns: (p: any[]) => void;
}

export function InfluencePanel({
  activeInfluence,
  setActiveInfluence,
  activePatterns,
  setActivePatterns,
}: InfluencePanelProps) {
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState<"influence" | "patterns">("influence");

  // Influence tab state
  const [searchMode, setSearchMode] = useState<"title" | "vibe">("title");
  const [titleQuery, setTitleQuery] = useState("");
  const [vibeQuery, setVibeQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundPacket, setFoundPacket] = useState<any | null>(null);
  const [vibeResults, setVibeResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Patterns tab state
  const [patterns, setPatterns] = useState<any[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsGenLoading, setPatternsGenLoading] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  const fetchPatterns = async () => {
    setPatternsLoading(true);
    setPatternsError(null);
    try {
      const res = await fetch("/api/work-packets/patterns");
      const data = await res.json();
      setPatterns(data.patterns ?? []);
    } catch {
      setPatternsError("Failed to load patterns.");
    }
    setPatternsLoading(false);
  };

  useEffect(() => {
    if (activeTab === "patterns" && show) {
      fetchPatterns();
    }
  }, [activeTab, show]);

  const handleTitleSearch = async () => {
    if (!titleQuery.trim() || searching) return;
    setSearching(true);
    setFoundPacket(null);
    setSearchError(null);
    try {
      // First try to find existing
      const res = await fetch(`/api/work-packets?title=${encodeURIComponent(titleQuery.trim())}`);
      const data = await res.json();
      if (data.packet) {
        setFoundPacket(data.packet);
      } else {
        // Research it
        const res2 = await fetch("/api/research/work-packet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: titleQuery.trim() }),
        });
        const data2 = await res2.json();
        if (data2.error) setSearchError(data2.error);
        else setFoundPacket(data2.packet ?? data2);
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    }
    setSearching(false);
  };

  const handleVibeSearch = async () => {
    if (!vibeQuery.trim() || searching) return;
    setSearching(true);
    setVibeResults([]);
    setSearchError(null);
    try {
      const res = await fetch("/api/work-packets/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: vibeQuery.trim(), limit: 5 }),
      });
      const data = await res.json();
      if (data.error) setSearchError(data.error);
      else setVibeResults(data.results ?? []);
    } catch {
      setSearchError("Search failed. Please try again.");
    }
    setSearching(false);
  };

  const handleGeneratePatterns = async () => {
    if (patternsGenLoading) return;
    setPatternsGenLoading(true);
    setPatternsError(null);
    try {
      const res = await fetch("/api/work-packets/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) setPatternsError(data.error);
      else setPatterns(data.patterns ?? []);
    } catch {
      setPatternsError("Failed to generate patterns.");
    }
    setPatternsGenLoading(false);
  };

  const togglePattern = (pattern: any) => {
    const isActive = activePatterns.some((p) => p.id === pattern.id);
    if (isActive) {
      setActivePatterns(activePatterns.filter((p) => p.id !== pattern.id));
    } else {
      if (activePatterns.length >= 3) return;
      setActivePatterns([...activePatterns, pattern]);
    }
  };

  const btnBase: React.CSSProperties = {
    padding: "5px 12px",
    border: "1px solid " + BORDER,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    background: SURFACE,
    color: MUTED,
    whiteSpace: "nowrap" as const,
  };

  const btnAccent: React.CSSProperties = {
    ...btnBase,
    background: ACCENT,
    color: "#fff",
    border: "1px solid " + ACCENT,
  };

  return (
    <>
      {/* Toolbar toggle button */}
      <button
        style={{
          ...btnBase,
          background: show ? "#1e1a35" : SURFACE,
          color: show ? ACCENT : MUTED,
          border: `1px solid ${show ? ACCENT : BORDER}`,
        }}
        onClick={() => setShow((v) => !v)}
        title="Make it like..."
      >
        ✦ Influence
        {activeInfluence && (
          <span style={{ marginLeft: 5, background: GREEN, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 10 }}>
            ON
          </span>
        )}
        {activePatterns.length > 0 && (
          <span style={{ marginLeft: 3, background: ACCENT, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 10 }}>
            {activePatterns.length}
          </span>
        )}
      </button>

      {/* Panel overlay */}
      {show && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1500,
          }}
          onClick={() => setShow(false)}
        >
          <div
            style={{
              background: BG,
              borderRadius: 14,
              width: 480,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px " + BORDER,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "16px 18px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Make it like...</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Reference a work or pattern to shape your writing</div>
                </div>
                <button
                  style={{ background: SURFACE, border: "1px solid " + BORDER, borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: MUTED, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => setShow(false)}
                >
                  ×
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 2, background: SURFACE, borderRadius: 8, padding: 3, border: "1px solid " + BORDER }}>
                {(["influence", "patterns"] as const).map((tab) => (
                  <button
                    key={tab}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      background: activeTab === tab ? ACCENT : "transparent",
                      color: activeTab === tab ? "#fff" : MUTED,
                    }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "influence" ? "Reference Influence" : "Craft Patterns"}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 18px" }}>

              {/* ── INFLUENCE TAB ── */}
              {activeTab === "influence" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Active influence card */}
                  {activeInfluence && (
                    <div style={{ background: "#12201a", border: "1px solid " + GREEN + "66", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{activeInfluence.title}</span>
                            <span style={{ fontSize: 10, background: GREEN, color: "#fff", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>✓ Active</span>
                          </div>
                          {activeInfluence.medium && (
                            <div style={{ fontSize: 11, color: MUTED }}>{activeInfluence.medium}</div>
                          )}
                        </div>
                        <button
                          style={{ ...btnBase, fontSize: 10, padding: "3px 8px", color: "#d94545", borderColor: "#d9454566" }}
                          onClick={() => setActiveInfluence(null)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode switcher */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["title", "vibe"] as const).map((m) => (
                      <button
                        key={m}
                        style={{
                          padding: "4px 12px",
                          border: "1px solid " + (searchMode === m ? ACCENT : BORDER),
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          background: searchMode === m ? "#1e1a35" : SURFACE,
                          color: searchMode === m ? ACCENT : MUTED,
                        }}
                        onClick={() => { setSearchMode(m); setFoundPacket(null); setVibeResults([]); setSearchError(null); }}
                      >
                        {m === "title" ? "By title" : "By vibe"}
                      </button>
                    ))}
                  </div>

                  {/* By title mode */}
                  {searchMode === "title" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          style={{ flex: 1, padding: "8px 10px", background: SURFACE, border: "1px solid " + BORDER, borderRadius: 7, fontSize: 12, color: TEXT, outline: "none" }}
                          placeholder='Search by title (e.g. Parasite, The Wire)...'
                          value={titleQuery}
                          onChange={(e) => setTitleQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleTitleSearch()}
                        />
                        <button
                          style={{ ...btnAccent, opacity: searching || !titleQuery.trim() ? 0.5 : 1, cursor: searching || !titleQuery.trim() ? "not-allowed" : "pointer" }}
                          onClick={handleTitleSearch}
                          disabled={searching || !titleQuery.trim()}
                        >
                          {searching ? "..." : "Search"}
                        </button>
                      </div>

                      {searching && (
                        <div style={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>Researching this work...</div>
                      )}

                      {searchError && (
                        <div style={{ fontSize: 11, color: "#d94545", padding: "8px 10px", background: "#1a0808", borderRadius: 6, border: "1px solid #d9454544" }}>{searchError}</div>
                      )}

                      {foundPacket && (
                        <div style={{ background: SURFACE, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{foundPacket.title}</div>
                              {foundPacket.medium && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{foundPacket.medium}</div>}
                            </div>
                            {foundPacket.status === "provisional" && (
                              <span style={{ fontSize: 10, color: AMBER, background: "#1a1400", border: "1px solid " + AMBER + "66", borderRadius: 4, padding: "2px 6px", fontWeight: 600, flexShrink: 0 }}>
                                ⚠ Provisional
                              </span>
                            )}
                          </div>
                          {foundPacket.thematicCore && (
                            <div style={{ fontSize: 11, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
                              {String(foundPacket.thematicCore).slice(0, 100)}{String(foundPacket.thematicCore).length > 100 ? "..." : ""}
                            </div>
                          )}
                          {foundPacket.principles && (
                            <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>
                              {Array.isArray(foundPacket.principles) ? foundPacket.principles.length : 0} craft principles
                            </div>
                          )}
                          <button
                            style={{ ...btnAccent, width: "100%", textAlign: "center" as const }}
                            onClick={() => { setActiveInfluence(foundPacket); setFoundPacket(null); }}
                          >
                            Write with this influence
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By vibe mode */}
                  {searchMode === "vibe" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        style={{ width: "100%", minHeight: 72, padding: "8px 10px", background: SURFACE, border: "1px solid " + BORDER, borderRadius: 7, fontSize: 12, color: TEXT, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const, fontFamily: "inherit", lineHeight: 1.5 }}
                        placeholder='e.g. "isolated protagonist, slow-burn dread, ambiguous morality"'
                        value={vibeQuery}
                        onChange={(e) => setVibeQuery(e.target.value)}
                      />
                      <button
                        style={{ ...btnAccent, opacity: searching || !vibeQuery.trim() ? 0.5 : 1, cursor: searching || !vibeQuery.trim() ? "not-allowed" : "pointer" }}
                        onClick={handleVibeSearch}
                        disabled={searching || !vibeQuery.trim()}
                      >
                        {searching ? "Searching..." : "Find similar works"}
                      </button>

                      {searchError && (
                        <div style={{ fontSize: 11, color: "#d94545", padding: "8px 10px", background: "#1a0808", borderRadius: 6, border: "1px solid #d9454544" }}>{searchError}</div>
                      )}

                      {vibeResults.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {vibeResults.map((result: any, i: number) => (
                            <div key={i} style={{ background: SURFACE, border: "1px solid " + BORDER, borderRadius: 7, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{result.title}</div>
                                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                                  {result.medium && <span style={{ fontSize: 10, color: MUTED }}>{result.medium}</span>}
                                  {result.score != null && (
                                    <span style={{ fontSize: 10, color: ACCENT }}>
                                      {Math.round((result.score ?? 0) * 100)}% match
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                style={{ ...btnAccent, padding: "4px 10px", fontSize: 10 }}
                                onClick={() => setActiveInfluence(result)}
                              >
                                Use this
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5, borderTop: "1px solid " + BORDER, paddingTop: 10, marginTop: 4 }}>
                    GhostWriter extracts craft patterns only — no plot, dialogue, or characters from reference works are used in generation.
                  </div>
                </div>
              )}

              {/* ── PATTERNS TAB ── */}
              {activeTab === "patterns" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* Active patterns count */}
                  <div style={{ fontSize: 11, color: MUTED }}>
                    <span style={{ color: activePatterns.length >= 3 ? AMBER : TEXT, fontWeight: 600 }}>{activePatterns.length}</span>
                    /3 patterns active
                  </div>

                  {patternsLoading && (
                    <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>Loading patterns...</div>
                  )}

                  {patternsError && (
                    <div style={{ fontSize: 11, color: "#d94545", padding: "8px 10px", background: "#1a0808", borderRadius: 6, border: "1px solid #d9454544" }}>{patternsError}</div>
                  )}

                  {!patternsLoading && patterns.length === 0 && !patternsError && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 12, color: MUTED }}>No patterns generated yet.</div>
                      <button
                        style={{ ...btnAccent, opacity: patternsGenLoading ? 0.5 : 1, cursor: patternsGenLoading ? "not-allowed" : "pointer" }}
                        onClick={handleGeneratePatterns}
                        disabled={patternsGenLoading}
                      >
                        {patternsGenLoading ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "influence-spin 0.7s linear infinite" }} />
                            Generating...
                          </span>
                        ) : "Generate patterns"}
                      </button>
                    </div>
                  )}

                  {patterns.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {patterns.map((pattern: any) => {
                        const isActive = activePatterns.some((p) => p.id === pattern.id);
                        const atMax = activePatterns.length >= 3 && !isActive;
                        return (
                          <div
                            key={pattern.id}
                            style={{
                              background: isActive ? "#1e1a35" : SURFACE,
                              border: "1px solid " + (isActive ? ACCENT + "88" : BORDER),
                              borderRadius: 8,
                              padding: "8px 10px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{pattern.name}</div>
                              {pattern.description && (
                                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                                  {pattern.description}
                                </div>
                              )}
                              {pattern.supportingWorks && (
                                <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
                                  {Array.isArray(pattern.supportingWorks) ? pattern.supportingWorks.length : pattern.supportingWorks} supporting works
                                </div>
                              )}
                            </div>
                            <button
                              style={{
                                padding: "3px 9px",
                                border: "1px solid " + (isActive ? ACCENT : BORDER),
                                borderRadius: 5,
                                cursor: atMax ? "not-allowed" : "pointer",
                                fontSize: 10,
                                fontWeight: 600,
                                background: isActive ? ACCENT : SURFACE,
                                color: isActive ? "#fff" : MUTED,
                                opacity: atMax ? 0.4 : 1,
                                flexShrink: 0,
                              }}
                              onClick={() => !atMax && togglePattern(pattern)}
                              disabled={atMax}
                              title={atMax ? "Max 3 patterns active at once" : isActive ? "Deactivate" : "Activate"}
                            >
                              {isActive ? "Active" : "Add"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes influence-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
