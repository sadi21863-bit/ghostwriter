import { COMBAT_STYLES } from "@/lib/combat";
import { decodeCharacterSkills } from "@/lib/types/story";

/**
 * Cross-references a character's own World Bible skills (characters.skills, a free-text
 * JSONB array) against the real combat-style library (src/lib/combat), so a villain-pov
 * or Combat-mode fight scene can auto-ground itself in whatever fighting style the author
 * already established for that character, instead of always requiring a blind manual pick
 * from a 17-option dropdown with zero story grounding.
 *
 * Only matches an EXACT (case-insensitive, trimmed) style name -- a vague skill like
 * "fighting" or "self-defense" is intentionally left unmatched rather than guessed, since
 * a wrong guess would silently ground the scene in the wrong biomechanics.
 */
export function suggestCombatStyleForCharacter(character: { skills?: unknown } | null | undefined): string | null {
  if (!character) return null;
  const skills = decodeCharacterSkills(character.skills);
  const styleNames = Object.keys(COMBAT_STYLES);
  for (const skill of skills) {
    const name = skill.name?.toLowerCase().trim();
    if (!name) continue;
    const match = styleNames.find((s) => s.toLowerCase() === name);
    if (match) return match;
  }
  return null;
}
