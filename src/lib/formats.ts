import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";

export const FORMATS = [
  "Novel", "Screenplay", "Web Series",
  "YouTube Long-form", "YouTube Short",
  "TikTok Script", "TikTok Native", "Instagram Reel", "Podcast Episode",
];
export const CREATOR_FORMATS = ["YouTube Long-form", "YouTube Short", "TikTok Script", "TikTok Native", "Instagram Reel", "Podcast Episode"];
export const STORY_FORMATS = ["Novel", "Screenplay", "Web Series"];
export const isCreatorFormat = (f: string) => CREATOR_FORMATS.includes(f);
export const isStoryFormat = (f: string) => STORY_FORMATS.includes(f);
// Lowercase noun for the format, used in publishing-document prompts
// ("query letter for this novel/screenplay/web series") so they don't
// default to calling everything a "novel".
export const getFormatNoun = (format: string): string =>
  (({ Novel: "novel", Screenplay: "screenplay", "Web Series": "web series" } as Record<string, string>)[format] ?? "novel");
export const getChapterLabel = (format: string): string =>
  (({ Novel: "Chapter", Screenplay: "Scene", "Web Series": "Episode", "YouTube Long-form": "Section", "YouTube Short": "Beat", "TikTok Script": "Beat", "TikTok Native": "Beat", "Instagram Reel": "Beat", "Podcast Episode": "Segment" } as Record<string, string>)[format] ?? "Chapter");
// User-facing label for the format picker. "Screenplay" alone tested as
// ambiguous for discoverability (could be a TV pilot too) — the internal
// format key is unchanged, this only affects display text.
export const getFormatDisplayLabel = (format: string): string =>
  format === "Screenplay" ? "Screenplay (Film / Movie script)" : format;
export const FORMAT_HELPER_TEXT: Partial<Record<string, string>> = {
  Screenplay: "A movie/film script in scene format.",
};
export const FORMAT_COLORS: Record<string, string> = {
  "Novel": "#5b4ccc", "Screenplay": "#0ea5e9", "Web Series": "#8b5cf6",
  "YouTube Long-form": "#ef4444", "YouTube Short": "#f97316", "TikTok Script": "#ec4899",
  "TikTok Native": "#fe2c55", "Instagram Reel": "#a855f7", "Podcast Episode": "#10b981",
};

export const GENRES = ["Fantasy", "Sci-Fi", "Horror", "Thriller", "Romance", "Drama", "Comedy", "Mystery", "Literary Fiction", "Action", "Historical", "Dystopian", "Noir", "Satire"];
// Order = MODE_REGISTRY's key order = mode tab display order in ToolbarPanel.tsx's visibleModes.
export const MODES = Object.keys(MODE_REGISTRY) as GenerationMode[];
export const PODCAST_MODES = ["brainstorm", "outline", "write", "cohost"];
export const STYLE_ATTRS = ["Pacing", "Tone", "POV Style", "Dialogue Style", "Sentence Structure", "Atmosphere"];

export interface FormatCapabilities {
  hasCohost: boolean;
  usesSegments: boolean;
  chapterLabel: string;
}

export const FORMAT_CONFIG: Record<string, FormatCapabilities> = {
  "Novel":              { hasCohost: false, usesSegments: false, chapterLabel: "Chapter" },
  "Screenplay":         { hasCohost: false, usesSegments: false, chapterLabel: "Scene" },
  "Web Series":         { hasCohost: false, usesSegments: false, chapterLabel: "Episode" },
  "YouTube Long-form":  { hasCohost: false, usesSegments: false, chapterLabel: "Section" },
  "YouTube Short":      { hasCohost: false, usesSegments: false, chapterLabel: "Beat" },
  "TikTok Script":      { hasCohost: false, usesSegments: false, chapterLabel: "Beat" },
  "TikTok Native":      { hasCohost: false, usesSegments: false, chapterLabel: "Beat" },
  "Instagram Reel":     { hasCohost: false, usesSegments: false, chapterLabel: "Beat" },
  "Podcast Episode":    { hasCohost: true,  usesSegments: true,  chapterLabel: "Segment" },
};

export function formatHasCohost(format: string): boolean {
  return FORMAT_CONFIG[format]?.hasCohost ?? false;
}

export function formatUsesSegments(format: string): boolean {
  return FORMAT_CONFIG[format]?.usesSegments ?? false;
}

export const DEFAULT_CHAR = { name: "", role: "", age: "", appearance: "", personality: "", thinkingStyle: "", behavior: "", habits: "", fears: "", desires: "", speechPattern: "", backstory: "", arc: "", voiceProfile: "", voiceId: "" };
export const DEFAULT_LOC = { name: "", description: "", atmosphere: "", history: "", sensoryDetails: "" };
export const DEFAULT_PLOT = { name: "", description: "", status: "Active", stakes: "", connections: "" };

export const CharFields: [string, string, string][] = [
  ["name", "Name", "input"], ["role", "Role", "input"], ["age", "Age", "input"],
  ["appearance", "Appearance", "textarea"], ["personality", "Personality", "textarea"],
  ["thinkingStyle", "Thinking style", "textarea"], ["behavior", "Behavior patterns", "textarea"],
  ["habits", "Habits & quirks", "textarea"], ["fears", "Fears", "textarea"],
  ["desires", "Desires", "textarea"], ["speechPattern", "Speech pattern", "textarea"],
  ["backstory", "Backstory", "textarea"], ["arc", "Character arc", "textarea"],
];
export const LocFields: [string, string, string][] = [
  ["name", "Name", "input"], ["description", "Description", "textarea"],
  ["atmosphere", "Atmosphere", "textarea"], ["history", "History", "textarea"],
  ["sensoryDetails", "Sensory details", "textarea"],
];
export const PlotFields: [string, string, string][] = [
  ["name", "Thread Name", "input"], ["description", "Description", "textarea"],
  ["stakes", "Stakes", "textarea"], ["connections", "Connections", "textarea"],
];
