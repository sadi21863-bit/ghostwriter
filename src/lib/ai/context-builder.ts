const CATEGORY_WEIGHTS: Record<string, number> = {
  character_decision: 3,
  relationship: 3,
  world_rule: 2,
  event: 2,
  general: 1,
};

function scoredMemories(memories: any[], chapters: any[], activeChapterId: string): any[] {
  const activeIdx = chapters?.findIndex((c: any) => c.id === activeChapterId) ?? 0;
  const scored = memories.map((m: any) => {
    const categoryScore = CATEGORY_WEIGHTS[m.category] ?? 1;
    const recencyScore = Math.max(0, 5 - (activeIdx - (m.chapterIndex ?? 0)));
    return { ...m, _score: categoryScore + recencyScore };
  });
  return scored.sort((a: any, b: any) => b._score - a._score).slice(0, 8);
}

export function buildContext(p) {
  const r = [];
  r.push("PROJECT: " + p.name + " | " + p.format + " | " + (p.genres || []).join(", "));

  if (p.referenceWorks?.length) {
    r.push("STYLE REFERENCES:");
    p.referenceWorks.forEach(w => {
      r.push('- "' + w.title + '"');
      Object.entries(w.attributes || {}).filter(([, v]) => v).forEach(([k, v]) => r.push("  " + k + ": " + v));
    });
  }

  if (p.characters?.length) {
    r.push("CHARACTERS:");
    p.characters.forEach(c => {
      if (c.alwaysInContext === false) {
        r.push("- " + c.name + (c.role ? " (" + c.role + ", minor)" : " (minor)"));
        return;
      }
      const parts = ["- " + c.name + (c.role ? " (" + c.role + ")" : "") + (c.age ? ", age " + c.age : "")];
      if (c.appearance) parts.push("  Appearance: " + c.appearance);
      if (c.personality) parts.push("  Personality: " + c.personality);
      if (c.thinkingStyle) parts.push("  Thinking: " + c.thinkingStyle);
      if (c.behavior) parts.push("  Behavior: " + c.behavior);
      if (c.habits) parts.push("  Habits: " + c.habits);
      if (c.speechPattern) parts.push("  Speech: " + c.speechPattern);
      if (c.fears) parts.push("  Fears: " + c.fears);
      if (c.desires) parts.push("  Desires: " + c.desires);
      if (c.arc) parts.push("  Arc: " + c.arc);
      if (c.backstory) parts.push("  Backstory: " + c.backstory);
      if (c.linkedLocationIds?.length) {
        const linked = p.locations?.filter((l: any) => c.linkedLocationIds.includes(l.id));
        if (linked?.length) parts.push("  Frequent locations: " + linked.map((l: any) => l.name).join(", "));
      }
      if (c.linkedPlotThreadIds?.length) {
        const linked = p.plotThreads?.filter((t: any) => c.linkedPlotThreadIds.includes(t.id));
        if (linked?.length) parts.push("  Involved in: " + linked.map((t: any) => t.name).join(", "));
      }
      r.push(parts.join("\n"));
    });
  }

  if (p.locations?.length) {
    r.push("LOCATIONS:");
    p.locations.forEach(l => {
      if (l.alwaysInContext === false) {
        r.push("- " + l.name + " (minor location)");
        return;
      }
      const parts = ["- " + l.name + (l.description ? ": " + l.description : "")];
      if (l.atmosphere) parts.push("  Atmosphere: " + l.atmosphere);
      if (l.history) parts.push("  History: " + l.history);
      if (l.sensoryDetails) parts.push("  Sensory: " + l.sensoryDetails);
      r.push(parts.join("\n"));
    });
  }

  if (p.plotThreads?.length) {
    r.push("PLOTS:");
    p.plotThreads.forEach(t => {
      if (t.alwaysInContext === false) {
        r.push("- [" + (t.status || "Active") + "] " + t.name + " (minor thread)");
        return;
      }
      const parts = ["- [" + t.status + "] " + t.name + (t.description ? ": " + t.description : "")];
      if (t.stakes) parts.push("  Stakes: " + t.stakes);
      if (t.connections) parts.push("  Connections: " + t.connections);
      r.push(parts.join("\n"));
    });
  }

  if (p.storyMemories?.length) {
    const salient = scoredMemories(p.storyMemories, p.chapters ?? [], p.activeChapter ?? "");
    r.push("ESTABLISHED FACTS (do not contradict these):");
    salient.forEach((m: any) => r.push(`- [${m.category}] ${m.fact}`));
  }

  return r.join("\n");
}

export function buildCreatorContext(p: any): string {
  const r: string[] = [];
  r.push(`PROJECT: ${p.name} | ${p.format} | ${(p.genres || []).join(", ")}`);

  const cb = p.creatorBible;
  if (cb) {
    r.push("CHANNEL BIBLE:");
    if (cb.channelName)        r.push(`Channel: ${cb.channelName}`);
    if (cb.niche)              r.push(`Niche: ${cb.niche}`);
    if (cb.audienceAge)        r.push(`Audience age: ${cb.audienceAge}`);
    if (cb.audienceInterests)  r.push(`Audience interests: ${cb.audienceInterests}`);
    if (cb.audiencePainPoints) r.push(`Pain points: ${cb.audiencePainPoints}`);
    if (cb.channelVoice)       r.push(`Voice & tone: ${cb.channelVoice}`);
    if (cb.contentPillars?.length) r.push(`Pillars: ${cb.contentPillars.join(", ")}`);
    if (cb.defaultCta)         r.push(`Default CTA: ${cb.defaultCta}`);
  }

  if (p.referenceWorks?.length) {
    r.push("STYLE REFERENCES:");
    p.referenceWorks.forEach((w: any) => {
      r.push(`- "${w.title}"`);
      Object.entries(w.attributes || {}).filter(([, v]) => v)
        .forEach(([k, v]) => r.push(`  ${k}: ${v}`));
    });
  }

  if (p.storyMemories?.length) {
    const salient = scoredMemories(p.storyMemories, p.chapters ?? [], p.activeChapter ?? "");
    r.push("ESTABLISHED FACTS (do not contradict these):");
    salient.forEach((m: any) => r.push(`- [${m.category}] ${m.fact}`));
  }

  return r.join("\n");
}

export function buildBeginnerContext(p) {
  const r = [];
  r.push("PROJECT: " + p.name + " | " + p.format + " | " + (p.genres || []).join(", "));

  if (p.characters?.length) {
    r.push("\nMAIN CHARACTERS:");
    p.characters.slice(0, 5).forEach(c => {
      const parts = [c.name + (c.role ? " (" + c.role + ")" : "")];
      if (c.appearance) parts.push(c.appearance);
      if (c.personality) parts.push(c.personality);
      r.push("- " + parts.join(" · "));
    });
  }

  if (p.locations?.length) {
    r.push("\nKEY LOCATIONS:");
    p.locations.slice(0, 3).forEach(l => {
      r.push("- " + l.name + (l.description ? ": " + l.description : ""));
    });
  }

  if (p.plotThreads?.length) {
    r.push("\nMAIN PLOT:");
    p.plotThreads.slice(0, 2).forEach(t => {
      r.push("- " + t.name + (t.description ? ": " + t.description : ""));
    });
  }

  return r.join("\n");
}
