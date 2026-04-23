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
      r.push(parts.join("\n"));
    });
  }

  if (p.locations?.length) {
    r.push("LOCATIONS:");
    p.locations.forEach(l => {
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
      const parts = ["- [" + t.status + "] " + t.name + (t.description ? ": " + t.description : "")];
      if (t.stakes) parts.push("  Stakes: " + t.stakes);
      if (t.connections) parts.push("  Connections: " + t.connections);
      r.push(parts.join("\n"));
    });
  }

  return r.join("\n");
}
