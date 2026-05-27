// src/lib/atmosphere/environments/all-environments.ts
import type { AtmosphereArchetype } from "../types";

export const NATURAL_RESTORATIVE: AtmosphereArchetype = {
  name: "Natural / Restorative",
  coreDescription: "Environments dominated by vegetation, water, and non-threatening organic complexity. Ulrich's SRT (1991) demonstrates that even passive visual exposure to natural scenes — a view through a window, a poster — reduces cortisol and accelerates recovery from stress faster than equivalent urban exposure. The Kaplan ART framework identifies the mechanism: natural environments provide 'soft fascination' — effortless attention that allows directed-attention resources to recover. Writing nature is not decoration; it is working directly on the reader's nervous system.",

  psychologicalEffect: {
    cognitiveState: "Soft fascination (ART): effortless, outward-directed attention that restores cognitive resources. The mind drifts without strain. This is the state most conducive to insight, memory, and emotional processing.",
    stressResponse: "SRT: nature reduces sympathetic activation and increases parasympathetic tone. Cortisol drops. Heart rate variability increases. The body registers safety at a physiological level even when the conscious mind has not decided anything.",
    attentionalDemand: "Low — the environment provides interest without demand. A river moving, leaves shifting, clouds changing are inherently watchable without requiring the kind of processing that built environments demand.",
    restorationPotential: "High. Kaplan's four properties are all present: being away (psychological distance from demand), extent (sufficient complexity to explore), compatibility (the environment fits basic human needs), fascination (interest without effort).",
  },

  sensoryLayers: {
    dominant: "Auditory/Visual parity — in nature, neither sense dominates. Sound and sight arrive with equal weight.",
    visual: "Non-uniform complexity: the fractal pattern of leaves, the irregular surface of water. The eye can rest on any point and find something that holds it without requiring resolution. Light is variable and alive: filtered, shifting, directional.",
    auditory: "Layered and non-uniform: wind, water, insects, birds — each at a different frequency and rhythm. No single sound sustains. The absence of human-generated sound (specifically the absence of white noise and engine sound) is felt as relief before it is identified.",
    olfactory: "Soil, plant decomposition, rain on rock, water. These scents activate olfactory memories that are specifically old (LOVER research: Larsson et al., 2014 — olfactory memories cluster in earliest adult years). Nature smells are frequently early-childhood smells for most people, and therefore access the most emotionally vivid autobiographical memory layer.",
    tactile: "Temperature variation — direct sun, dappled shade, wind through clothing. Ground surface feedback through feet. Air that moves differently from indoor air.",
    proprioceptive: "The ground is uneven. The body is required to be present to maintain balance, which grounds attention in the physical. Natural terrain requires minor proprioceptive investment that keeps consciousness embodied.",
  },

  temporalQualities: "Natural environments change at multiple speeds simultaneously: light shifts by the minute, weather changes by the hour, seasons over months. A scene set in nature has built-in time-passage indicators that work below the reader's conscious awareness.",

  emotionalApplications: {
    grief: "Nature's indifference — the river continuing, the birds indifferent — amplifies grief rather than comforting it. The world's persistence in the face of loss.",
    fear: "Natural environments can shift from restorative to threatening: the same forest becomes different at night. The SRT restoration response inverts when the environment registers as threatening rather than safe.",
    joy: "Genuine joy finds natural environments confirming and expansive. The body's ventral vagal state matches the environment's openness.",
    tension: "Natural silence amplifies approaching threat. The absence of human-generated sound means any sudden human sound registers more sharply.",
    intimacy: "Low environmental demand frees attention for each other. The soft fascination of natural environments means both people have enough background stimulus to not feel the pressure of sustained eye contact.",
  },

  olfactoryKey: "Rain on soil (petrichor) and organic decomposition are the highest-valence olfactory keys in natural environments. Both activate autobiographical memories that date to early childhood for most people — specifically outdoor play, summer, freedom from constraint. Herz (2004) found odor-evoked memories show more amygdala/hippocampus activation than vision-evoked memories of the same event.",

  failureModes: [
    "Nature is described as beautiful or peaceful — generic adjectives that do not activate the reader's senses.",
    "The olfactory layer is absent — smell is the highest-memory-valence sense and is the most consistently omitted.",
    "The visual description is static — natural environments are defined by movement and change.",
    "Nature is used as backdrop rather than as an active element that changes how the characters feel.",
    "The description is comprehensive rather than selective — one specific, true sensory detail is worth more than a complete inventory.",
  ],

  systemDirectives: [
    "Lead with movement: the water, the leaves, the light — nothing in nature is still.",
    "Include the olfactory layer — specifically what activates memory: soil, rain, organic decay.",
    "Choose one non-visual sense to anchor the environment: sound or smell, not sight.",
    "Let the environment's psychological effect (restoration, cortisol reduction) work through the character's body — describe the physical release, not the peace.",
    "Use the environment's emotional application appropriate to the scene's emotional register.",
  ],

  writingNotes: "The most economical way to use nature in a scene is to let it say the thing the character cannot. A character who cannot cry sitting by a river that moves regardless. A character who is trying to be calm and the birds continuing without concern. Nature is not a mirror of the character's emotions — it is indifferent, and that indifference is the most powerful thing it offers.",
};

export const URBAN_BUILT: AtmosphereArchetype = {
  name: "Urban / Built Environment",
  coreDescription: "Urban environments demand directed attention (ART) — the built environment is full of signals that require processing: traffic, faces, signage, social cues, the continuous task of navigation. Ulrich's SRT shows urban environments maintain higher cortisol baselines than natural environments and slow recovery from stress. This is not a failure mode — it is a tool. Urban environments are where urgency lives, where anonymity and density create specific emotional textures available nowhere else.",

  psychologicalEffect: {
    cognitiveState: "Hard fascination (ART) — the environment demands directed attention continuously. The city is never passive. It requires the person to be processing at all times: traffic, social cues, navigation, noise.",
    stressResponse: "SRT: urban environments maintain sympathetic activation at a low-level steady state. The body is not in threat-mode but is not in rest either. This low-grade vigilance is felt as energy, density, or exhaustion depending on the character's state.",
    attentionalDemand: "High — the built environment provides constant bottom-up stimulation that captures attention rather than releasing it. This produces cognitive fatigue over sustained exposure.",
    restorationPotential: "Low by default; pocket parks, water features, and tree lines temporarily restore (Ulrich & Kaplan both documented this). Their presence in urban scenes is therefore specific and felt.",
  },

  sensoryLayers: {
    dominant: "Auditory — urban environments have the most complex and dense soundscapes of any environment type. Sound is the first sense engaged and the last to release.",
    visual: "Hard edges, artificial light, reflective surfaces, faces. The visual field is full of intentional signals (advertising, signs, architecture) that require decoding.",
    auditory: "Layered mechanical, human, and natural sound. The specific signature: engine hum below 200Hz forms the constant ground layer; human voices at 500-2000Hz; and the occasional siren, horn, or impact above that. Specific urban soundscapes are immediately location-identifying.",
    olfactory: "The urban olfactory palette: exhaust, food cooking, garbage, rain on hot pavement (different from rain on soil), perfume, old buildings, underground air. PRF research: urban smells often activate later autobiographical memories than natural smells — urban smell-memories cluster in adolescence and young adulthood.",
    tactile: "Temperature extremes: urban heat island in summer, wind tunnel effect between buildings. Hard underfoot. Crowd-induced warmth and pressure.",
    proprioceptive: "Even terrain — the body relaxes its proprioceptive attention, allowing the mind to run. The danger: dissociation. Characters in urban environments can become disconnected from their bodies in ways that characters in natural environments cannot.",
  },

  temporalQualities: "Urban environments have sharply defined temporal signatures: morning rush, midday lull, evening commute, night. Time of day is legible from the soundscape alone. The city at 3am is a different environment from the city at noon, even in the same location.",

  emotionalApplications: {
    grief: "Urban indifference is more aggressive than natural indifference — the crowd that doesn't notice, the city that demands navigation while the character is destroyed. The gap between the city's demands and the character's capacity.",
    fear: "Urban environments amplify fear through the alibi of normalcy: anyone could be dangerous, no one will help, the crowd conceals the threat. The building that looks empty.",
    joy: "Cities contain the specific joy of anonymity and abundance: no one knows you, everything is possible, the lights are on everywhere. The city at night with somewhere to go.",
    tension: "Urban environments sustain tension through noise, density, and the impossibility of full spatial awareness. You cannot see all the doors.",
    intimacy: "Urban intimacy is created against the environment — the pocket of stillness in the loud restaurant, the specific quality of two people who have found quiet in the middle of noise.",
  },

  olfactoryKey: "Rain on hot pavement (urban petrichor) and underground/subway air are the highest-valence urban olfactory keys. Both access adolescent and young-adult autobiographical memory layers (the period when most people first experienced the city independently).",

  failureModes: [
    "The city is described as busy and noisy — these are the correct adjectives and therefore useless.",
    "The olfactory layer is absent or generic: 'the smell of the city.' Name the specific components.",
    "The urban environment is static — cities pulse with temporal rhythm; a scene set at 3am should feel different from one at noon.",
    "The character's cognitive load from the urban environment is not felt — the directed attention demand is physical and affects how the character thinks.",
  ],

  systemDirectives: [
    "Anchor with a specific urban sound at the right frequency layer: the ground hum, the human layer, or the sharp layer above.",
    "Name the specific olfactory component: exhaust plus specific food plus rain on pavement — not 'city smell.'",
    "Specify the time of day through the soundscape, not through stating the time.",
    "Let the directed-attention demand of the urban environment register on the character — they are processing even when they don't want to be.",
  ],

  writingNotes: "The city's power in fiction is that it does not care. Natural environments are indifferent in a slow, ancient way — they were here before us and will be here after. Cities are indifferent in an immediate, human way — they were built by people and persist without any individual person. A character alone in a crowd is one of fiction's most economical images. The city provides the crowd without providing anything else.",
};

export const CONFINED_ENCLOSED: AtmosphereArchetype = {
  name: "Confined / Enclosed Space",
  coreDescription: "Enclosed spaces — small rooms, vehicles, closets, cells — produce specific psychological and physiological effects through reduced environmental stimulation and forced proximity. The key dynamic is the relationship between available space and required psychological intimacy: enclosed spaces force proximity that would not otherwise occur and remove the spatial option to disengage.",

  psychologicalEffect: {
    cognitiveState: "Variable — in non-threatening enclosure, directed attention shifts inward. Without external stimulation, the mind turns to its own content. In threatening enclosure, threat-response dominates all processing.",
    stressResponse: "Dependent on perceived threat: enclosed space that is voluntarily occupied and not threatening produces a mild privacy response (decreased vigilance). Enclosed space perceived as trap produces rapid sympathetic activation.",
    attentionalDemand: "Low environmental demand but high interpersonal demand — there is nothing to attend to except the other person or the self. Enclosed spaces amplify interpersonal dynamics.",
    restorationPotential: "High for solitary occupation (restoration through privacy, reduction of social vigilance), low when occupied by incompatible persons.",
  },

  sensoryLayers: {
    dominant: "Tactile and olfactory — in reduced visual space, the other senses register more strongly.",
    visual: "Limited range produces specific effects: the eye cannot rest at distance. Near-field focus is tiring over sustained periods. The environment is quickly and completely known — there is nothing new to discover.",
    auditory: "Sound bounces differently in small spaces: the room becomes a resonator. Other people's sounds — breathing, fabric movement, small movements — are louder. Silence between people is louder.",
    olfactory: "Smell accumulates in enclosed spaces. The olfactory profile of a small room includes the humans in it: body warmth, breath, specific personal scents. PRF research: the smell of another person is one of the strongest autobiographical memory triggers — it accesses memories of specific relationships.",
    tactile: "Temperature rises with human occupation. Air becomes less fresh over time. Physical proximity may be forced — the car, the elevator, the small waiting room. The sense of available volume.",
    proprioceptive: "The body is aware of the space's boundaries. Stretching, standing, turning are limited. This constraint is felt as tension that has no release.",
  },

  temporalQualities: "Time in enclosed spaces moves differently. Extended enclosure produces awareness of duration in ways that open spaces do not — the car journey, the waiting room, the holding cell. The same conversation that would take 20 minutes in a large room takes 20 minutes in a small one, but feels longer.",

  emotionalApplications: {
    grief: "Confined space amplifies grief by removing the option of spatial movement as regulation. The grief cannot walk out. It has to stay with the person.",
    fear: "The enclosure is the threat — or the enclosure prevents escape from the threat. Both produce specific claustrophobic fear patterns.",
    joy: "Private enclosure with someone chosen: the conspiracy of two. The small space is protective rather than constraining.",
    tension: "Forced proximity with incompatible persons: the silence in the elevator, the long car journey, the small room with the dangerous person.",
    intimacy: "Enclosed spaces are generators of involuntary intimacy: people share space, air, and silence in ways that accelerate the quality of knowing.",
  },

  olfactoryKey: "The smell of another person in an enclosed space — the specific combination of warmth, breath, and personal scent — is among the most powerful olfactory memory activators. PRF: this smell accesses relationship memories with the specific person. When the character has a history with the other person in the room, this olfactory trigger can activate memories that the character did not intend to have.",

  failureModes: [
    "The enclosed space is described geometrically rather than experientially — dimensions instead of sensory reality.",
    "The proximity effect is not used: two characters in a small room who do not register each other's physical presence.",
    "Sound in enclosed spaces is not amplified — small rooms are louder than open spaces.",
    "The olfactory density of human occupation is absent.",
  ],

  systemDirectives: [
    "Name the temperature: human occupation warms small spaces measurably.",
    "Include the sound amplification: breathing, fabric, movement are louder in small spaces.",
    "Use the olfactory accumulation: other people's presence is detectable.",
    "The boundaries of the space must be felt by the body.",
    "Let the proximity that cannot be resolved do its work on the characters.",
  ],

  writingNotes: "Enclosed spaces are where revelations happen in fiction not because writers like small rooms, but because the spatial impossibility of leaving forces characters to remain in the presence of what they would otherwise escape. The car journey, the elevator, the tiny waiting room — they generate the duration of exposure that difficult conversations require.",
};

export const LIMINAL_THRESHOLD: AtmosphereArchetype = {
  name: "Liminal / Threshold Space",
  coreDescription: "Liminal spaces are between-states: corridors, doorways, waiting rooms, airports, bus stations, the hour before dawn. They are neither departure nor arrival. The psychological experience of liminal space is characterized by suspended identity and suspended time — the person is not yet who they will be, no longer exactly who they were. Liminality produces specific cognitive and emotional receptivity: the normal defensive structures of identity are temporarily relaxed.",

  psychologicalEffect: {
    cognitiveState: "Suspended — the person is between cognitive frames. The identity and behavioral scripts of the origin state no longer fully apply; the scripts of the destination state are not yet active. This gap produces openness, vulnerability, and sometimes dissociation.",
    stressResponse: "Mild sympathetic activation from uncertainty, but modulated by the social permission to be in transition. Waiting rooms are culturally sanctioned not-yet spaces. The body registers the permission.",
    attentionalDemand: "Variable but often dissociative — liminal spaces encourage inward attention precisely because the external environment provides insufficient claim. The waiting room, the airport gate — the eye drifts.",
    restorationPotential: "Moderate — liminal spaces are often restorative because they sanction inaction and release the demand for purposeful engagement. But they cannot restore fully because the unresolved transition creates background anxiety.",
  },

  sensoryLayers: {
    dominant: "Temporal — the defining quality of liminal space is not any particular sense but the particular experience of time.",
    visual: "Often transitional light: the hour before dawn, fluorescent light in empty corridors, the grey of the airport before morning. These light qualities signal biological in-between-ness.",
    auditory: "Specific ambient sounds: the HVAC hum of institutions, the distant PA announcement, the mechanical sounds of transport. These sounds are designed to be ignored and therefore register below conscious attention as a continuous presence.",
    olfactory: "Institutional smell: cleaning products, recycled air, the lack of natural organic smell. The institutional olfactory signature is notable for what it suppresses — the smell of particular people, the smell of outdoors. PRF: institutional smells activate memories of other institutional experiences — schools, hospitals, waiting.",
    tactile: "Often neutral — controlled temperature, smooth surfaces, the designed elimination of strong sensory input that would compete with the primary purpose of transit.",
    proprioceptive: "The body is often in an unresolved postural state: neither sitting comfortably nor standing purposefully. The waiting posture. The transitional gait of someone between destinations.",
  },

  temporalQualities: "Time in liminal spaces has a specific quality of suspension. The airport at 3am, the waiting room, the corridor — time does not flow normally. It stagnates. Or it suddenly accelerates when the transition completes.",

  emotionalApplications: {
    grief: "Airports are where people are left. Doorways are where people go. The liminal space extends the goodbye: the moment of departure that has not yet fully occurred.",
    fear: "The empty corridor, the building before occupants arrive — liminal spaces become threatening when the transition does not occur. The person who should have arrived who hasn't. The door that should have opened.",
    joy: "The anticipation of arrival: the door about to open. Liminality that is almost complete.",
    tension: "The unresolved transition as a structural metaphor: the character who cannot move, cannot go back, cannot yet arrive.",
    intimacy: "Two people in transition together: the confidences of airports and waiting rooms. The social permission to be honest while in between.",
  },

  olfactoryKey: "Institutional cleaning products — bleach, floor cleaner, recycled air — activate memories of previous institutional waiting: hospital waiting rooms, school corridors, prior airports. The olfactory key here is specifically the absence of individual human smell, which triggers a particular quality of anonymity and vulnerability.",

  failureModes: [
    "Liminal spaces are described through their purpose (it was a corridor, it was a waiting room) rather than their specific sensory reality.",
    "Time does not behave differently in the liminal space — it should.",
    "The institutional olfactory layer is absent.",
    "The character's suspended identity is not registered — they continue in their full identity rather than the in-between state.",
  ],

  systemDirectives: [
    "Let time move differently in this space: slower, suspended, then suddenly complete.",
    "Include the institutional olfactory signature.",
    "The character's identity is temporarily relaxed — they may say or do something they would not in their origin or destination state.",
    "Transitional light: dawn light, fluorescent light, the grey before color.",
    "The unresolved posture: neither sitting properly nor standing fully.",
  ],

  writingNotes: "Liminal spaces are where characters become honest. The conversation in the airport, the confession in the corridor, the thing said in the waiting room — these locations produce speech that would not occur in the normal context of the characters' lives. The social permission of not-yet-having-arrived removes the social constraint of being in a defined role. Write the thing the character says that they would never say anywhere else.",
};

export const DECAYED_ABANDONED: AtmosphereArchetype = {
  name: "Decayed / Abandoned Space",
  coreDescription: "Spaces that have been abandoned by human occupation and are being reclaimed by entropy: derelict buildings, overgrown ruins, neglected rooms, dead places that were once alive. The psychological effect is a specific confrontation with time — the evidence of prior human presence without the humans, which produces a particular quality of absence that is more specific than the absence in an empty natural space.",

  psychologicalEffect: {
    cognitiveState: "Induced melancholy and temporal dissociation — the environment provides constant evidence of human activity now absent, which forces temporal perspective. The person in a ruined building is simultaneously in the present and in an implied past.",
    stressResponse: "Mildly elevated sympathetic activation from environmental signals of disrepair (unstable surfaces, unclear sight lines, evidence of threat), combined with a specific emotional quality of loss that engages the dorsal vagal system.",
    attentionalDemand: "High — abandoned spaces contain evidence that requires interpretation: what happened, when, to whom. The environment is a text that demands reading.",
    restorationPotential: "Low — abandoned spaces produce melancholy rather than restoration. They are useful for emotional amplification rather than recovery.",
  },

  sensoryLayers: {
    dominant: "Visual — decay is primarily a visual register: the water stain, the flaking paint, the broken window.",
    visual: "Entropy produces specific visual textures: organic growth over inorganic structure, water stain patterns, the collapse of order into chaos. The light is often wrong: too much where there should be cover, too dark where there should be light.",
    auditory: "Absence of human-generated sound makes non-human sound amplified: wind through broken panes, structural settling, vermin movement, distant mechanical sounds. Silence in abandoned spaces is not restorative; it is the silence of something gone.",
    olfactory: "Decay has a specific complex smell: mold, dust, damp, old wood, rat urine, the sweet smell of decomposing organic material. PRF: this olfactory complex is strongly associated with fear and avoidance in most people, but also with specific memories of place — the back room of an old house, the basement, the attic.",
    tactile: "Surfaces that should be solid are not. Temperature is wrong: cold and damp where it should be warm and dry, or hot where ventilation has failed. The floor requires conscious trust.",
    proprioceptive: "Unstable ground requires heightened proprioceptive attention. The body cannot relax into automatic locomotion — it must monitor each step.",
  },

  temporalQualities: "Abandoned spaces are temporally layered — the current abandonment exists simultaneously with the implied prior occupation. The specific temporal quality is a visible palimpsest: the present (decay) over the past (use) over the implied future (continued entropy or reclamation).",

  emotionalApplications: {
    grief: "The most direct application: the space holds the evidence of the absent. A child's room after a death. The office after the company collapsed. The things that were not taken.",
    fear: "Environmental instability (floors, ceilings, sight lines) combined with the olfactory profile of decay produces fear with a specific quality: the threat is time itself.",
    joy: "Almost never used directly — but reclaimed abandonment (the neglected garden blooming, the derelict building refilled with life) is a specific joy of persistence.",
    tension: "The unclear sight lines, the unstable surfaces, the sounds that require interpretation — abandoned spaces are structurally tensionful.",
    intimacy: "Abandonment as privacy: the place no one goes, where the two characters are genuinely alone in a way that normally occupied spaces cannot provide.",
  },

  olfactoryKey: "Mold and damp are the highest-valence olfactory keys in abandoned spaces. The specific combination of wet wood, mold, and old dust activates a particular quality of memory that most people associate with places that should not be entered — the forbidden room, the basement, the attic. This olfactory memory accesses early-childhood prohibition memories.",

  failureModes: [
    "Abandoned spaces are described as creepy — a judgment rather than a sensory reality.",
    "The olfactory profile of decay is absent.",
    "The visual entropy is generic: 'the place was a mess.' Name the specific decay: water stains at a specific height, a specific pattern of broken glass, a specific growth.",
    "The floor is trusted automatically — the body should require conscious permission to trust unstable surfaces.",
  ],

  systemDirectives: [
    "Include the decay smell: mold, damp, specific organic decomposition.",
    "Make the floor require conscious trust — at least one surface gives uncertain feedback.",
    "The light is wrong: describe specifically how it does not behave as it should in an occupied space.",
    "The temporal layering: show the present decay over the implied prior use — objects left behind.",
    "Silence is not peaceful in abandoned spaces: it is the silence of something removed.",
  ],

  writingNotes: "The power of abandoned spaces is the implied presence of whoever is not there. A child's shoe. A calendar open to a year ago. The table still set. These specific, small objects do more than any atmospheric description because they are the evidence of someone specific who was here and is now not. The abandoned space is always about the absent person — not the place.",
};
