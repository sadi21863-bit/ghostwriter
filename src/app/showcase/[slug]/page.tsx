"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useGwTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ShowcaseData {
  title: string;
  blurb: string;
  format: string;
  genres: string[];
  coverImageUrl: string | null;
  excerpt: string;
  previewImages: string[];
  previewVideoUrl: string | null;
}

export default function ShowcaseViewPage() {
  useGwTheme();
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    fetch(`/api/showcase/${slug}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  const report = async () => {
    await fetch(`/api/showcase/${slug}/report`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Reported from the showcase view page." }),
    }).catch(() => {});
    setReported(true);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading…</div>;
  if (error || !data) return <div style={{ padding: 40, textAlign: "center" }}>This showcase isn&apos;t available.</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gw-page)", color: "var(--gw-t1)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 16 }}><ThemeToggle /></div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 60px" }}>
        {data.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.coverImageUrl} alt="cover" style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, marginBottom: 20 }} crossOrigin="anonymous" />
        )}
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{data.title}</h1>
        <div style={{ fontSize: 12, color: "var(--gw-t3)", marginBottom: 16 }}>
          {data.format}{data.genres?.length ? ` · ${data.genres.join(", ")}` : ""}
        </div>
        {data.blurb && <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>{data.blurb}</p>}

        {data.previewVideoUrl && (
          <video src={data.previewVideoUrl} controls style={{ width: "100%", borderRadius: 10, marginBottom: 24 }} />
        )}

        {data.previewImages.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
            {data.previewImages.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`preview ${i + 1}`} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 8 }} crossOrigin="anonymous" />
            ))}
          </div>
        )}

        {data.excerpt && (
          <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", padding: 20, background: "var(--gw-sunk)", borderRadius: 10, marginBottom: 24 }}>
            {data.excerpt}
          </div>
        )}

        <button
          onClick={report}
          disabled={reported}
          style={{ fontSize: 11, color: "var(--gw-t3)", background: "transparent", border: "1px solid var(--gw-border)", borderRadius: 6, padding: "4px 10px", cursor: reported ? "default" : "pointer" }}
        >
          {reported ? "Reported — thank you" : "Report this showcase"}
        </button>
      </div>
    </div>
  );
}
