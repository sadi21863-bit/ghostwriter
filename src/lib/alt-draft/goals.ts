import type { AltDraftGoal } from '@/types';

export const ALT_DRAFT_GOALS: Record<AltDraftGoal, { label: string; directive: string }> = {
  'tighter-prose': {
    label: 'Tighter Prose',
    directive: 'Cut every word that does not earn its place. Remove redundancy, reduce adverbs, tighten sentences. Target 15-20% word reduction without losing meaning or any story event.',
  },
  'more-emotional': {
    label: 'More Emotional',
    directive: 'Deepen the emotional register through sensory grounding, physical sensation, and interiority. Do not name emotions directly - show them through behavior and body. Do not add new plot events.',
  },
  'stronger-suspense': {
    label: 'Stronger Suspense',
    directive: 'Increase tension by delaying resolution, ending paragraphs on uncertainty, and withholding information strategically. Use sentence rhythm to accelerate or brake. No new plot events.',
  },
  'continuity-repair': {
    label: 'Continuity Repair',
    directive: 'Fix continuity. Ensure every character acts only on information they possess at this point in the story. Correct factual inconsistencies with the world bible. Preserve all original plot events.',
  },
  'clearer-prose': {
    label: 'Clearer Prose',
    directive: 'Improve clarity. Break complex sentences. Ensure each paragraph has one clear purpose. Reduce unintentional ambiguity. Do not reduce intentional ambiguity or add/remove events.',
  },
  'sharper-dialogue': {
    label: 'Sharper Dialogue',
    directive: 'Sharpen every dialogue line. Each exchange must reveal character, advance plot, or create conflict - preferably all three. Cut small talk. Add subtext. Preserve all beats.',
  },
};
