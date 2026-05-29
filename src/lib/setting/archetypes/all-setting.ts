// src/lib/setting/archetypes/all-setting.ts
import type { SettingArchetype } from "../types";

export const PROSPECT_REFUGE: SettingArchetype = {
  name: "Prospect-Refuge",
  theoreticalBasis: "Jay Appleton's The Experience of Landscape (1975): human aesthetic preferences for environments are evolutionary, not culturally constructed. Prospect = the ability to see without being seen (open vistas, elevated positions). Refuge = the ability to hide or withdraw (enclosure, canopy, protective geometry). The most preferred environments offer both simultaneously — the prospect-refuge interface. The café table facing the door. The alcove with a full view of the room. These are not preferences — they are evolved threat-detection operating as spatial behavior.",
  coreDescription: "The character navigates space according to an ancient survival grammar they are not consciously aware of. Where they position themselves, what they notice first, what makes them physically uncomfortable in a room — all of this is character revelation without a single direct statement.",
  spatialMechanism: "The character's spatial behavior reveals their current psychological state more precisely than any narrated internal monologue. The paranoid character seeks maximum sightlines and minimum exposure. The open, trusting character seeks comfort-refuge without scanning for threats. The predatory character seeks positions that give them prospect while concealing them from others — they always know where everyone in the room is.",
  sensoryHierarchy: "Visual (sightlines, exits, who is present) dominant. Proprioceptive secondary (the physical comfort or discomfort of the position chosen). Auditory tertiary (what can be heard from this position without being seen to listen).",
  characterReveal: "Two characters enter the same room. One moves immediately to the corner seat with their back to the wall. The other walks to the center and stands there comfortably. This is not a description of paranoia and openness — it IS the paranoia and openness, shown through spatial grammar.",
  writingDirectives: [
    "When a character enters a new space, note where they position themselves and why — this is always characterization",
    "The character's first scan of a room reveals what they are threat-monitoring for",
    "High-prospect positions (elevated, wide sightlines) for hypervigilant characters; refuge positions (backed against something solid, partially enclosed) for comfort-seeking characters",
    "Characters under threat naturally seek prospect-refuge interface without consciously thinking about it",
    "The character who violates their own spatial grammar under stress is showing a break in their usual defenses",
  ],
  failureModes: [
    "The character enters a room and immediately tells us how they feel about it — spatial behavior should precede and replace this narration",
    "The setting is described neutrally without attending to the character's specific relationship to its spatial grammar",
    "All characters navigate space the same way regardless of their psychology",
    "The prospect-refuge analysis is narrated rather than enacted",
  ],
  systemDirectives: [
    "The first paragraph in any new space should locate the character precisely: where do they stand or sit, what is behind them, what do their eyes scan first",
    "This positioning is character information — the paranoid and the open character do not enter the same room the same way",
    "Never write 'she felt comfortable' when 'she found a table with her back to the wall and a full view of the entrance' carries the same information with more precision",
    "Spatial discomfort (the character in a position that violates their natural prospect-refuge preference) is a physical sensation — write it in the body",
  ],
  writingNotes: "The Prospect-Refuge framework works best when the writer knows each character's spatial psychology in advance and treats every room they enter as a revelation opportunity. The detective who always chooses the corner seat, the trauma survivor who positions exits, the secure person who sits wherever there's a chair — these are not stylistic choices. They are evolved behavior expressing current psychological state. The space is never neutral."
};

export const RESTORATIVE_ENVIRONMENT: SettingArchetype = {
  name: "Restorative",
  theoreticalBasis: "Rachel and Stephen Kaplan's Attention Restoration Theory (1989, 1995): different environments place different cognitive demands. Urban/technological environments require continuous directed attention. Natural environments engage soft fascination (effortless, undirected attention that allows directed attention to recover). Four restorative properties: Being Away, Extent, Soft Fascination, Compatibility. The empirical finding: 50-minute walks in nature measurably reduce anxiety, rumination, and improve working memory.",
  coreDescription: "The character is placed in an environment that restores their cognitive capacity. This is not vague atmosphere — it is neuropsychological mechanism. A character who needs to reach an insight placed in an ART-compliant natural environment is undergoing documented cognitive restoration.",
  spatialMechanism: "Soft fascination captures the character's attention effortlessly — they notice the moving water, the quality of light, without effort or direction. Their directed attention (which was overwhelmed) is recovering. The rumination that was blocking insight is reducing.",
  sensoryHierarchy: "Auditory (moving water, wind, natural rhythms) and visual (soft, non-threatening movement) dominant. Smell secondary (natural environments trigger Proustian return to outdoor memories). Proprioceptive (the body's sense of being in open space, the ground underfoot).",
  characterReveal: "A character who cannot be restored even by a maximally restorative environment has a level of distress that transcends cognitive fatigue — and that failure of restoration is itself the most important information.",
  writingDirectives: [
    "A character in a restorative environment should have the quality of attention visibly shift — from directed/effortful to soft/receiving",
    "The insight or decision that emerges in this environment must feel like it arrived, not like the character reached for it",
    "Include at least one soft-fascination element: moving water, clouds, fire, leaves in wind",
    "The restoration is incomplete if it is interrupted by technology, social obligation, or the return of directed attention demands",
    "A character who cannot be restored here is carrying something beyond cognitive depletion",
  ],
  failureModes: [
    "The natural setting is described as backdrop rather than active agent restoring the character's cognition",
    "The insight arrives before the restoration process is complete — the character is thinking clearly too soon",
    "The restorative environment is used as vague 'peaceful atmosphere' without its specific psychological function",
    "All natural settings are equally restorative regardless of which ART properties they possess",
  ],
  systemDirectives: [
    "Establish the character's state of cognitive depletion before entering the restorative environment",
    "The restoration process is gradual: directed attention releasing, soft fascination engaging, rumination reducing",
    "The specific sensory elements that trigger soft fascination must be named precisely",
    "The insight or resolution arrives in the body before it arrives as thought",
  ],
  writingNotes: "The restorative environment scene is most powerful when the writer knows why this character needs cognitive restoration at this moment. The executive who cannot solve the problem until they walk by the river. The detective whose mind clears on the hillside. The environment is not backdrop — it is doing something physiologically real to this person."
};

export const OLFACTORY_ANCHOR: SettingArchetype = {
  name: "Olfactory Anchor",
  theoreticalBasis: "The Proust Effect: olfactory memory is uniquely potent because smell is the only sense routing directly to the amygdala and hippocampus without cortical preprocessing. Every other sense is analyzed first. Smell bypasses the analytical filter and arrives directly at emotion and memory simultaneously. Properties: more emotional, more self-relevant, more vivid-in-context. The mémoire involontaire Proust described: not a deliberate recall but an experiential return.",
  coreDescription: "A smell in the present environment triggers an involuntary return to a past moment with full emotional intensity. The character does not decide to remember — the memory arrives. The smell of the specific cleaning product, the particular combination of pipe smoke and leather — these are keys that open the past without permission.",
  spatialMechanism: "The olfactory trigger acts before the character's analytical mind can process it. They feel the emotional content of the past moment before they identify the source. The body responds to the smell before the mind knows what the smell means.",
  sensoryHierarchy: "Olfactory primary and dominant — the specific, accurate smell rather than the general category. Not 'it smelled of the sea' but the specific combination of low-tide kelp, diesel from the nearby dock, and a particular mineral quality that belongs to one specific place.",
  characterReveal: "What smell triggers the strongest return reveals what the character's most emotionally charged memories are. The character who freezes at the smell of chalk dust tells us what the character is made of.",
  writingDirectives: [
    "The olfactory trigger must be specific — not a category smell but the exact compound: cheap floor cleaner + rubber + old paper",
    "The return to the past memory must be involuntary — the character does not choose to remember",
    "The emotional content of the triggered memory arrives in the body before it is identified in the mind",
    "The present scene momentarily recedes as the past-moment returns",
    "The character's ability to function in the present is briefly compromised by the involuntary return",
  ],
  failureModes: [
    "The smell is a category (the sea, old books) rather than a specific compound",
    "The character deliberates about whether to remember — the Proust Effect is involuntary",
    "The emotional content of the triggered memory is narrated rather than experienced",
    "The return to the past moment is a flashback in structure rather than an involuntary sensory overlay on the present",
  ],
  systemDirectives: [
    "Identify the specific olfactory compound before writing the scene — what exact combination of smells?",
    "The emotional arrival precedes the cognitive identification: 'something tightened in her chest before she understood why'",
    "The past-moment that returns should be the one the story most needs to surface at this point",
    "Write the present scene thinning as the past-scene thickens, then the return",
  ],
  writingNotes: "The sensory hierarchy for setting: smell first, not sight. Most AI prose describes what things look like. Real immersive setting description starts with what they smell like, because that is the fastest route to involuntary emotional response in the reader."
};

export const PLACE_ATTACHED: SettingArchetype = {
  name: "Place-Attached",
  theoreticalBasis: "Scannell and Gifford's tripartite framework (2010): place attachment has three dimensions. Place Identity: the place forms part of the character's self-concept. Place Dependence: the place provides resources supporting the character's goals. Place Social Bonding: attachment formed through shared connections. When place-attached characters are displaced, they lose not just a location but a portion of their self-definition.",
  coreDescription: "The character's relationship to a specific place is a relationship to themselves. The house they grew up in, the street they know by night — these are not locations. They are extensions of the character's identity structure. Forcing them to leave or watching the place change is watching a person change whether they choose to or not.",
  spatialMechanism: "The place-attached character navigates their familiar space with the ease of extended body memory — they do not look for things, they reach for them. The disruption of this ease is a signal of psychological change.",
  sensoryHierarchy: "All senses at equal depth — the place-attached character has multi-sensory knowledge accumulated over time. They know what it smells like at different times of day, what sounds belong to it, what the texture of familiar surfaces feels like. Strangers see; inhabitants know.",
  characterReveal: "The character returning to a place they were attached to as a child reveals how much they have changed — the place is the stable point, and the gap between the remembered self and the current self is measured against it.",
  writingDirectives: [
    "Place-attached characters move through familiar spaces without attending to them — automaticity is the signature of deep familiarity",
    "Describe the character's relationship to specific objects and details rather than the overall space",
    "Displacement (being forced to leave or watching the place change) is always an identity event, not just a location event",
    "The character's return to a place they were once attached to measures change through the gap between then and now",
    "The outsider in a place-attached character's space sees it differently — this gap is a source of conflict",
  ],
  failureModes: [
    "The place-attached character describes their space as a newcomer would — this removes the evidence of deep familiarity",
    "Displacement is treated as a practical problem rather than an identity disruption",
    "The return to a childhood place produces nostalgia without measuring the distance between selves",
    "The character's place-attachment is told rather than shown through their specific embodied relationship to the space",
  ],
  systemDirectives: [
    "Place-attached characters do not describe their own familiar spaces — they act within them without attending",
    "Write the specific objects that hold emotional weight for this character, not the overall description",
    "Displacement and return are always psychological events: what does this person lose or find when they lose or regain this place?",
    "The outsider who enters a place-attached character's space and sees it 'objectively' reveals the invisible familiarity by contrast",
  ],
  writingNotes: "The most powerful place-attachment scenes are the ones where the reader understands the character's relationship to the place more clearly than the character does. The character who returns to their childhood home and feels confused about why it seems smaller is not confused about the house. They are confused about who they are now."
};

export const HOSTILE_ENVIRONMENT: SettingArchetype = {
  name: "Hostile Environment",
  theoreticalBasis: "The inverse of Appleton's Prospect-Refuge theory: environments that offer neither prospect nor refuge activate evolved threat-response systems. Kaplan's directed attention theory inverse: environments that demand continuous vigilance without providing any restorative element produce cognitive and physiological exhaustion. The environment becomes an active antagonist.",
  coreDescription: "The setting is an active participant in the scene's threat. Not backdrop — antagonist. The narrow corridor that prevents flanking. The crowded market that puts civilians between the character and the exit. The basement with no windows. These environments work against the character's survival needs.",
  spatialMechanism: "The hostile environment removes spatial agency: the character cannot choose a better position, cannot see what is coming, cannot find refuge. Their evolved threat-detection fires continuously without resolution. Physiologically: elevated cortisol, narrowed visual field, heightened auditory acuity, degraded fine motor control.",
  sensoryHierarchy: "Auditory dominant (the sound that does not fit, the silence that is too complete). Proprioceptive secondary (the physical constraint of a hostile space registers in the body before the mind processes danger). Visual tertiary — and often unreliable (poor light, disorienting geometry, too much visual noise).",
  characterReveal: "How a character responds to spatial threat reveals their training, history, and psychological resources. The soldier who immediately begins reading the space for tactical information. The trauma survivor who freezes. None of these need to be narrated — the spatial behavior does all of it.",
  writingDirectives: [
    "The hostile environment must have specific physical properties that deny the character their preferred prospect-refuge position",
    "Write the physiological stress response before the cognitive analysis: tightened vision, heightened sound sensitivity, the body going into threat mode",
    "The environment's hostility should accumulate: each new spatial constraint is worse than the previous",
    "Never use 'the atmosphere was threatening' — the spatial properties are threatening and should be written as such",
    "The character's attempts to find a safer position within a hostile environment reveal their training and psychology",
  ],
  failureModes: [
    "The hostile environment is described as generically threatening without specific spatial properties",
    "The character's physiological response to the environment is narrated rather than enacted",
    "The environment's hostility is static rather than accumulating",
    "'The room felt wrong' — the room has specific wrong properties, not a feeling",
  ],
  systemDirectives: [
    "Define the specific spatial properties that make this environment hostile: no exits visible, confined, no elevated positions, disorienting geometry",
    "Write the body's response before the mind's: the narrowing of vision, the heightened hearing, the specific physical sensation of contained threat",
    "The hostile environment works against the character's spatial preferences — write the specific denial of their preferred position",
    "Accumulate the spatial constraints: each paragraph removes one more option",
  ],
  writingNotes: "The hostile environment is most powerful when it is doing something specific to a specific character. The agoraphobic person in a wide-open space, the claustrophobic person in a confined one — the environment is hostile because of what this character needs spatially, not because 'it was threatening.'"
};
