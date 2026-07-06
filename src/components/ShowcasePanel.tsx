"use client";
import { useEffect, useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";
import { toast } from "@/lib/toast";

interface Props {
  project: any;
  onClose: () => void;
}

interface ShowcaseState {
  slug?: string;
  title: string;
  blurb: string;
  visibility: "private" | "unlisted" | "public";
}

interface Preview {
  coverImageUrl: string | null;
  excerpt: string;
  previewImages: string[];
  previewVideoUrl: string | null;
}

const VISIBILITY_LABEL: Record<string, string> = {
  private: "Private — only you can see this",
  unlisted: "Unlisted — anyone with the link can view",
  public: "Public — listed in the Showcase discovery feed",
};

// Publish-then-flag surface (see docs/superpowers/plans for the showcase
// feature) — a project's showcase auto-derives its preview from existing
// content (buildShowcasePreview), no manual asset picker for v1.
export function ShowcasePanel({ project, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseState>({ title: project.name ?? "", blurb: "", visibility: "private" });
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${project.id}/showcase`)
      .then(r => r.json())
      .then(d => {
        if (d.showcase) setShowcase({ slug: d.showcase.slug, title: d.showcase.title, blurb: d.showcase.blurb, visibility: d.showcase.visibility });
        setPreview(d.preview ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project.id]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/showcase`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: showcase.title, blurb: showcase.blurb, visibility: showcase.visibility }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Couldn't save the showcase."); return; }
      setShowcase(prev => ({ ...prev, slug: data.slug }));
      toast.success("Showcase saved.");
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = showcase.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/showcase/${showcase.slug}` : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300 }} onClick={onClose}>
      <div style={{ background: co.surface, borderRadius: 14, width: 480, maxHeight: "85vh", overflow: "auto", padding: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: `1px solid ${co.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: co.text, marginBottom: 4 }}>🖼 Publish to Showcase</div>
        <div style={{ fontSize: 12, color: co.muted, marginBottom: 20 }}>Share what you've built — privately, via a link, or in the public discovery feed.</div>

        {loading ? (
          <p style={{ fontSize: 13, color: co.muted }}>Loading…</p>
        ) : (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Title</label>
            <input style={{ ...sInput, marginBottom: 14 }} value={showcase.title} onChange={e => setShowcase(s => ({ ...s, title: e.target.value }))} />

            <label style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Blurb</label>
            <textarea style={{ ...sInput, resize: "none", minHeight: 70, marginBottom: 14 }} rows={3} value={showcase.blurb} onChange={e => setShowcase(s => ({ ...s, blurb: e.target.value }))} />

            <label style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Visibility</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {(["private", "unlisted", "public"] as const).map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: co.text, cursor: "pointer" }}>
                  <input type="radio" name="visibility" checked={showcase.visibility === v} onChange={() => setShowcase(s => ({ ...s, visibility: v }))} />
                  {VISIBILITY_LABEL[v]}
                </label>
              ))}
            </div>

            {preview && (preview.coverImageUrl || preview.excerpt) && (
              <div style={{ border: `1px solid ${co.border}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: co.muted }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: co.text }}>Auto-generated preview</div>
                {preview.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.coverImageUrl} alt="cover" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, marginBottom: 6 }} crossOrigin="anonymous" />
                )}
                {preview.excerpt && <p style={{ margin: 0 }}>{preview.excerpt}</p>}
              </div>
            )}

            {shareUrl && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16, fontSize: 11, color: co.muted, wordBreak: "break-all" }}>
                <span style={{ color: co.text, flex: 1 }}>{shareUrl}</span>
                <button style={sBtnSm} onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied."); }}>Copy</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={sBtnSm} onClick={onClose}>Close</button>
              <button style={{ ...sBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
