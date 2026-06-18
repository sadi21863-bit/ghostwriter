import { plainTextToTipTap, isValidTipTapJson } from "@/lib/editor/content-migration";

export function appendToTipTap(existingContent: string, newText: string): string {
  const existing = isValidTipTapJson(existingContent)
    ? JSON.parse(existingContent)
    : plainTextToTipTap(existingContent);
  const newDoc = plainTextToTipTap(newText) as any;
  return JSON.stringify({
    type: 'doc',
    content: [...((existing as any).content || []), ...(newDoc.content || [])],
  });
}

export function buildNeighbourContext(p: any): string {
  const activeIdx = p.chapters.findIndex((c: any) => c.id === p.activeChapter);
  const parts: string[] = [];
  const recent = p.chapters.slice(Math.max(0, activeIdx - 2), activeIdx).filter((c: any) => c.summary);
  if (recent.length) {
    parts.push("RECENT CHAPTERS:");
    recent.forEach((c: any) => {
      const typeLabel = c.chapterType && c.chapterType !== "chapter" ? ` [${c.chapterType}]` : "";
      const tagLabel = c.tags?.length ? ` (${c.tags.join(", ")})` : "";
      parts.push(`[${c.title}${typeLabel}${tagLabel}]: ${c.summary}`);
    });
  }
  const next = p.chapters[activeIdx + 1];
  if (next) parts.push(`NEXT CHAPTER: "${next.title}" (not yet written — maintain narrative momentum toward this)`);
  const distant = p.chapters.filter((c: any, i: number) => c.id !== p.activeChapter && i < activeIdx - 2);
  if (distant.length) parts.push("EARLIER CHAPTERS (titles only): " + distant.map((c: any) => c.title).join(", "));
  return parts.join("\n");
}

export async function callAI(endpoint: string, body: any) {
  const res = await fetch("/api/ai/" + endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

// Streaming caller: sends { stream: true } and reads text deltas off the response
// body as they arrive, invoking onDelta for each chunk. If the server responds with
// JSON instead (gate / retryable / violation / error), that object is returned as-is
// so callers can handle it exactly like callAI().
export async function callAIStream(
  endpoint: string,
  body: any,
  onDelta: (chunk: string) => void,
): Promise<any> {
  const res = await fetch("/api/ai/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json") || !res.body) {
    try { return await res.json(); } catch { return { error: "Generation failed. Please try again." }; }
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) { text += chunk; onDelta(chunk); }
  }
  return { text };
}
