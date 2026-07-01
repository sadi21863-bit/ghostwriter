import type { CapabilityActionResult } from "@/lib/capabilities/actions";

/**
 * Studio is a separate route from the writing room, so it can't call
 * GhostWriterApp's setMode/setActionsOpen/setShowComicStudio/setShowProductionStudio
 * directly. Instead it navigates back to the project editor with a one-shot query
 * param that GhostWriterApp reads on mount and dispatches through its own state —
 * the existing one execution path, never a parallel one.
 */
export function studioDeepLink(projectId: string, action: CapabilityActionResult): string | null {
  const base = `/project/${projectId}`;
  switch (action.type) {
    case "selectMode": return `${base}?studioMode=${encodeURIComponent(action.mode)}`;
    case "openComicStudio": return `${base}?studioOpen=comic`;
    case "openProductionStudio": return `${base}?studioOpen=production`;
    case "openActions": return `${base}?studioOpen=actions`;
    case "upgrade":
    case "hint":
    case "noop":
      return null;
  }
}
