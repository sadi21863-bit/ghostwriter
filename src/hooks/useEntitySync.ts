"use client";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { matchEntities, diffEntity, ENTITY_API_PATH, ENTITY_TYPE, type EntitySuggestion } from "@/lib/ai/entity-extraction";

export function useEntitySync({ project, updateProject }: {
  project: any;
  updateProject?: (fn: (p: any) => any) => void;
}) {
  const [entitySuggestions, setEntitySuggestions] = useState<EntitySuggestion[]>([]);

  const runEntityExtraction = async (text: string) => {
    const matches = matchEntities(text, project, 3);
    if (!matches.length) return;
    const context = text.slice(0, 4000);
    for (const { type, entity } of matches) {
      try {
        const res = await fetch("/api/ai/entity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: ENTITY_TYPE[type], existing: entity, projectContext: context }),
        });
        const proposed = await res.json();
        const changes = diffEntity(type, entity, proposed);
        if (changes.length) {
          setEntitySuggestions(s => [...s, { type, entity, changes }]);
        }
      } catch { /* extraction must never break the writing flow */ }
    }
  };

  const acceptEntitySuggestion = async (suggestion: EntitySuggestion) => {
    const patch: Record<string, string> = {};
    suggestion.changes.forEach(c => { patch[c.field] = c.newValue; });
    try {
      const res = await fetch(`/api/projects/${project.id}/${ENTITY_API_PATH[suggestion.type]}/${suggestion.entity.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = await res.json();
      updateProject?.((p: any) => ({ ...p, [suggestion.type]: p[suggestion.type].map((x: any) => x.id === updated.id ? updated : x) }));
      setEntitySuggestions(s => s.filter(x => x !== suggestion));
    } catch {
      toast.error("Couldn't save that update — please try again.");
    }
  };

  const rejectEntitySuggestion = (suggestion: EntitySuggestion) => {
    setEntitySuggestions(s => s.filter(x => x !== suggestion));
  };

  return { entitySuggestions, acceptEntitySuggestion, rejectEntitySuggestion, runEntityExtraction };
}
