// src/lib/combat/context.ts
import type { CombatStyle } from "./types";
import { COMBAT_STYLES } from "./_registry";

export function buildCombatContext(styleAName: string, styleBName: string): string {
  const styleA = COMBAT_STYLES[styleAName];
  const styleB = COMBAT_STYLES[styleBName];

  if (!styleA && !styleB) return "";

  const blocks: string[] = [];
  blocks.push("COMBAT LIBRARY — ACTIVE STYLES");
  blocks.push("The following biomechanical data must inform every technique, stance, and movement in the fight scene. Use the correct names for techniques. Generate force from the ground up. Let strikes accumulate consequences across exchanges. Both fighters have strategy, not just reaction. Track distance explicitly.");

  if (styleA) blocks.push(formatStyle(styleA));
  if (styleB) blocks.push(formatStyle(styleB));

  if (styleA && styleB) {
    blocks.push(buildMatchupNotes(styleA, styleB));
  }

  return blocks.join("\n\n");
}

function formatStyle(s: CombatStyle): string {
  const lines: string[] = [];
  lines.push(`STYLE: ${s.name.toUpperCase()} (${s.origin})`);
  lines.push(`Philosophy: ${s.corePhilosophy}`);
  lines.push(`Body mechanics: ${s.bodyMechanics}`);
  lines.push(`Distance: ${s.distancePreference}`);
  lines.push(`Footwork: ${s.footworkPrinciple}`);

  if (s.stances.length) {
    lines.push("Stances:");
    s.stances.forEach(st =>
      lines.push(`  ${st.name} — ${st.bodyPosition} (${st.weightDistribution}) | Strengths: ${st.strengths} | Weaknesses: ${st.weaknesses}`)
    );
  }

  if (s.strikes.length) {
    lines.push("Techniques:");
    s.strikes.forEach(t => {
      lines.push(`  ${t.name}: ${t.mechanics}`);
      lines.push(`    Setup: ${t.setup}`);
      lines.push(`    Execution: ${t.execution}`);
      lines.push(`    Recovery: ${t.recovery}`);
      lines.push(`    Counter: ${t.counter}`);
    });
  }

  if (s.defenses.length) {
    lines.push("Defenses:");
    s.defenses.forEach(t => {
      lines.push(`  ${t.name}: ${t.mechanics}`);
    });
  }

  lines.push(`Signature tells: ${s.signatureTells.join(" | ")}`);
  lines.push(`Pacing: ${s.pacing}`);
  lines.push(`Writing notes: ${s.writingNotes}`);

  return lines.join("\n");
}

function buildMatchupNotes(a: CombatStyle, b: CombatStyle): string {
  const lines: string[] = [];
  lines.push(`MATCHUP: ${a.name.toUpperCase()} vs ${b.name.toUpperCase()}`);

  const aStrengths = a.strengthAgainst.filter(s =>
    s.toLowerCase().includes(b.name.toLowerCase()) ||
    b.weakAgainst.some(w => s.toLowerCase().includes(w.toLowerCase().split(" ")[0]))
  );
  const bStrengths = b.strengthAgainst.filter(s =>
    s.toLowerCase().includes(a.name.toLowerCase()) ||
    a.weakAgainst.some(w => s.toLowerCase().includes(w.toLowerCase().split(" ")[0]))
  );

  lines.push(`${a.name} advantages: ${aStrengths.length ? aStrengths.join("; ") : "See general strengths above."}`);
  lines.push(`${b.name} advantages: ${bStrengths.length ? bStrengths.join("; ") : "See general strengths above."}`);
  lines.push(`Range conflict: ${a.name} prefers ${a.distancePreference}. ${b.name} prefers ${b.distancePreference}. The fighter who controls range controls this fight.`);

  return lines.join("\n");
}

export function getCombatStyleNames(): string[] {
  return Object.keys(COMBAT_STYLES).sort();
}
