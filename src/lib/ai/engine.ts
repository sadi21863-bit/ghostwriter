import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return {}; }
}
export type GenerationMode = "brainstorm" | "outline" | "write";

const MI = {
  brainstorm: (_f: string) => `You are a creative brainstorming partner for writers. Generate specific, surprising, and vivid ideas. Avoid clichés. Every idea must be concrete and actionable — not "a mysterious stranger" but "a tax auditor who moonlights as a forger." Push beyond the obvious. Match the genre, tone, and style established in the project context — brainstorm ideas that fit this specific world, not generic ones.`,
  outline: (f: string) => `You are a structural editor for ${f} writing. Create tight, purposeful outlines where every scene advances character, plot, or both. Identify turning points explicitly. Show the cause-and-effect chain between events. Label each beat with its structural function (inciting incident, midpoint shift, dark night, climax). Match the established tone and genre from the project context. Be specific — no vague placeholders.`,
  write: (f: string) => `You are a ghostwriter producing ${f} content. Match the established voice and style exactly. Every scene must open with orientation (who, where, when) within the first two sentences. Show character emotion through physical action and specific detail — never name emotions directly. Maintain continuity with all established facts. End scenes on tension, decision, or revelation — never neutral ground.`,
};

const STORY_FORMAT_RULES: Record<string, string> = {
  "Novel": `NOVEL FORMAT RULES:
- Prose paragraphs, no screenplay formatting
- Vary sentence length deliberately — long for reflection, short for action
- Use consistent POV throughout each chapter
- Scene transitions must orient the reader: new time or new place
- Dialogue reveals character through what is NOT said as much as what is`,
  "Screenplay": `SCREENPLAY FORMAT RULES:
- INT./EXT. LOCATION — TIME for every new scene heading
- Action lines: present tense, visual only — no inner thoughts
- Character name centered ALL CAPS before each speech
- Parentheticals sparingly — only when delivery radically changes meaning
- Target 1 minute per page`,
  "Web Series": `WEB SERIES FORMAT RULES:
- Each episode needs a cold open hook in the first 90 seconds
- Act structure: 3 acts minimum, cliffhanger at each act break
- Episode-level problem that resolves + season-level arc that advances
- Dialogue punchy — streaming audiences have less patience than film`,
};

const FORMAT_RULES: Record<string, string> = {
  "YouTube Long-form": `FORMAT: YouTube Long-form
Structure: Hook (0-30s) → Context → Core Value → CTA
Target: 1200-2200 words (~8-15 min spoken)
Tone: conversational, like talking to one person
Add [B-ROLL: description] markers every 2-3 minutes
End with a specific CTA (subscribe / comment / watch next)`,

  "YouTube Short": `FORMAT: YouTube Short
Structure: HOOK → Conflict/Payoff → Loop ending (last line connects to hook)
Max 150 words (~60 seconds)
First 3 words must stop the scroll — no "hey guys", no intro
Start mid-action`,

  "TikTok Script": `FORMAT: TikTok Script
Structure: Hook (0-3s) → Tension → Reveal → Share trigger
Max 200 words (~90 seconds)
Hook must create an open loop or pattern interrupt
Add [TEXT ON SCREEN: ...] markers for every key point
Write for sound-off viewing`,

  "Instagram Reel": `FORMAT: Instagram Reel
Structure: Visual hook (0-3s) → Value delivery → Save/share trigger
Max 150 words (~60 seconds)
Add [VISUAL: description] markers for each scene change
Every reel needs one insight worth saving`,

  "Podcast Episode": `FORMAT: Podcast Episode
Structure: Cold open → Intro → Main content (3-5 segments) → Recap → CTA
Short sentences. Write for ears, not eyes.
Mark [AD BREAK] for sponsor placement
Mark [HOST NOTE: improvise here] for riff sections`,

  "Podcast Episode (Co-host)": `FORMAT: Podcast Co-host Simulation
OUTPUT FORMAT — CRITICAL:
- [CO-HOST]: one-sentence question or challenge
- [HOST TALKING POINTS]: 3-5 bullet points (NOT scripted prose — the host speaks naturally from these)
Co-host voice options:
  curious_generalist — asks "why" and "how", represents the audience
  skeptical_expert — challenges assumptions, asks for evidence
  enthusiastic_newcomer — expresses surprise, asks for clarification`,
};

export async function generate({ mode, prompt, context, format, maxTokens = 4000 }) {
  const formatRules = FORMAT_RULES[format]
    ? "\n\n" + FORMAT_RULES[format]
    : STORY_FORMAT_RULES[format]
    ? "\n\n" + STORY_FORMAT_RULES[format]
    : "";
  const system = MI[mode](format) + formatRules + "\n---\n" + context;
  const msg = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] });
  const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
  return { text, tokensUsed: msg.usage.input_tokens + msg.usage.output_tokens, model: "claude-sonnet-4-20250514" };
}
export async function analyzeWork(title) { const msg = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: 'Analyze "' + title + '". Return ONLY JSON: {"Pacing":"...","Tone":"...","POV Style":"...","Dialogue Style":"...","Sentence Structure":"...","Atmosphere":"..."}' }] }); return safeParseJson(msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim()); }
export async function generateEntity(type, prompt, ctx, existing) { const schemas = { character: "name,role,age,appearance,personality,thinkingStyle,behavior,habits,fears,desires,speechPattern,backstory,arc", location: "name,description,atmosphere,history,sensoryDetails", plotThread: "name,description,status,stakes,connections", creatorBible: "channelName,niche,audienceAge,audienceInterests,audiencePainPoints,channelVoice,contentPillars,defaultCta,competitorNotes" }; const userMsg = existing ? "Improve:\n" + JSON.stringify(existing) + "\nReturn JSON: {" + schemas[type] + "}" : prompt + "\nReturn JSON: {" + schemas[type] + "}"; const msg = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system: "Create " + type + "s. ONLY JSON. Context: " + ctx, messages: [{ role: "user", content: userMsg }] }); return safeParseJson(msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim()); }
export async function summarizeChapter(content) { const msg = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: "Summarize in 2-3 sentences for continuity:\n\n" + content }] }); return msg.content.filter(b => b.type === "text").map(b => b.text).join(""); }
export async function generateQuickStory(title, format, genres) { const genreStr = (genres || []).join(", ") || "Drama"; const prompt = `Create a complete story skeleton for a ${format} titled "${title}" in ${genreStr}. Return ONLY valid JSON with: {characters:[{name,role,age,appearance,personality},...], locations:[{name,description,atmosphere},...], plotThreads:[{name,description,stakes},...], outline:"Brief 3-act outline"}. Generate 3-4 characters, 2-3 locations, 2-3 plot threads.`; const msg = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }); const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim(); try { return JSON.parse(text); } catch (e) { return { characters: [], locations: [], plotThreads: [], outline: "" }; } }
export async function generateBeginnerCharacters(projectName, genres, count = 3) { const genreStr = (genres || []).join(", ") || "General"; const prompt = `Create ${count} diverse characters for "${projectName}" (${genreStr}). For each, provide only: name, role (main/supporting/antagonist), age, appearance (1 sentence), and personality (1 sentence). Return JSON: [{name,role,age,appearance,personality},...]`; const msg = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }); const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim(); try { return JSON.parse(text); } catch (e) { return []; } }