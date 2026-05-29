import { ENDINGS_ARCHETYPES } from "./index";

export function buildEndingsContext(archetypeName: string): string {
  const arch = ENDINGS_ARCHETYPES[archetypeName];
  if (!arch) return "";
  const l: string[] = [];
  l.push(`ENDINGS LIBRARY — ${arch.name.toUpperCase()}`);
  l.push(`Theoretical basis: ${arch.theoreticalBasis}`);
  l.push(`Core: ${arch.coreDescription}`);
  l.push(`\nRetroactive organizer: ${arch.retroactiveOrganizer}`);
  l.push(`Cost requirement: ${arch.costRequirement}`);
  l.push(`\nSYSTEM DIRECTIVES:`);
  arch.systemDirectives.forEach(d => l.push(`• ${d}`));
  l.push(`\nFAILURE CONDITIONS:`);
  arch.failureConditions.forEach(f => l.push(`✗ ${f}`));
  return l.join("\n");
}

export function getEndingsArchetypeNames(): string[] {
  return Object.keys(ENDINGS_ARCHETYPES);
}
