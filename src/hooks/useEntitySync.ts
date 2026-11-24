"use client";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { matchEntities, diffEntity, ENTITY_TYPE, type EntitySuggestion } from "@/lib/ai/entity-extraction";

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
    try {
      // §13.1: accepted canon edits ride a user-edit story transaction (recorded,
      // revertable) instead of a direct entity PATCH.
      const res = await fetch(`/api/projects/${project.id}/story-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "user-edit",
          changes: suggestion.changes.map((c) => ({
            entityKey: suggestion.type,
            entityId: suggestion.entity.id,
            field: c.field,
            oldValue: c.oldValue ?? "",
            newValue: c.newValue,
          })),
        }),
      });
      if (!res.ok) {
        let body: any = null;
        try { body = await res.json(); } catch { /* unparseable body = generic failure */ }
        // 404 or {missing:[…]} means the entity/project is gone — a stale
        // suggestion that self-heals by dropping the chip silently.
        if (res.status === 404 || (body && Array.isArray(body.missing))) {
          setEntitySuggestions(s => s.filter(x => x !== suggestion));
          return;
        }
        throw new Error("save failed");
      }
      // The response carries {transaction}, not entity rows — apply locally.
      updateProject?.((p: any) => ({
        ...p,
        [suggestion.type]: p[suggestion.type].map((x: any) => x.id === suggestion.entity.id
          ? { ...x, ...Object.fromEntries(suggestion.changes.map((c) => [c.field, c.newValue])) }
          : x),
      }));
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
