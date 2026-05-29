// src/lib/historical/archetypes/all-historical.ts
import type { HistoricalArchetype } from "../types";

export const LONGUE_DUREE: HistoricalArchetype = {
  name: "Longue Durée",
  theoreticalBasis: "Fernand Braudel's Annales framework (1949, 1966): historical time has three layers moving at radically different speeds. The longue durée — geographical time — is the almost-permanent structure of human existence: geography, climate, agricultural systems, basic social organization, the relationship between the body and the world. These structures move so slowly they appear static within any one lifetime. The crucial insight: the longue durée is the deepest layer of any historical setting. The 16th-century Florentine merchant and the 16th-century Florentine beggar share the same longue durée — the same relationship to mortality, season, disease, and physical labor that no amount of wealth entirely separates them from.",
  coreDescription: "The permanent material conditions of existence in this kind of society — the structures that are so foundational they are invisible to the people living within them. Not history as events, but history as the ground all events happen on. Writing at the longue durée layer means writing the things characters don't notice because they have never known anything else.",
  temporalLayer: "Centuries to millennia — the structures that appear permanent within any one lifetime",
  groundingMechanic: "The longue durée is grounded through the physical body's relationship to its world: what the body must do to survive, what natural cycles shape the year, what risks are always present regardless of individual circumstances. Food, weather, disease, the physical demands of work — these are the longue durée made visible.",
  detailStrategy: "The detail that reveals the longue durée is the detail characters don't explain because it requires no explanation — the thing that is simply how things are. The winter storage calculation. The specific relationship between harvest quality and winter mortality. The material costs of illumination after dark.",
  writingDirectives: [
    "The longue durée is never explained by characters — they live within it without seeing it",
    "Write the physical body's relationship to its world: what must the body do to survive in this time and place?",
    "The underlying permanence should feel different from both the events of the narrative and the social forces of the conjuncture",
    "Modern comfort assumptions must be stripped: illumination after dark, food preservation, warmth in winter, distance — all were costs",
    "Every character regardless of wealth or status shares the longue durée — disease, season, death remain universally present",
  ],
  failureModes: [
    "Historical setting treated only at the événement level (events and dialogue) with no longue durée layer",
    "The physical material conditions of existence are absent — characters move through historical events without inhabiting historical bodies",
    "The permanent structures are explained or commented upon by characters who would not notice them",
    "Modern assumptions about convenience, speed, and access slip in without acknowledgment",
  ],
  systemDirectives: [
    "Before writing, establish: what is the relationship between this character's body and the fundamental material conditions of their world?",
    "The longue durée must be felt in the scene, not described — it is the ground the events happen on",
    "Write at least one detail that a modern reader might not expect, sourced from the permanent structures of this type of society",
    "Characters do not comment on the longue durée — they are inside it",
  ],
  writingNotes: "The most common failure in historical fiction is writing the costume drama: period-appropriate events and dialogue floating above a material reality that has been invisibly modernized. Characters don't feel cold in winter the way we don't feel cold in a climate-controlled room. The longue durée is the layer that makes historical fiction feel real rather than costumed."
};

export const CONJUNCTURAL_PRESSURE: HistoricalArchetype = {
  name: "Conjunctural Pressure",
  theoreticalBasis: "Braudel's second timescale — social time (decades to centuries): economic cycles, social trends, the rise and fall of institutions and ideologies. The conjuncture moves fast enough to be felt within a single lifetime — prices rising, a religious authority shifting, a trade route opening, a technology spreading. This is what historians call 'historical context' but Braudel insists it is a structural layer, not just backdrop: the conjuncture actively shapes what is possible, what is thinkable, and what is dangerous within a specific historical moment.",
  coreDescription: "The large-scale forces of the specific decade or generation pressing on every individual life. The character who complains about the price of bread is not delivering historical exposition — they are living inside a specific conjunctural moment. The conjuncture is the pressure that the narrative's events take place within.",
  temporalLayer: "Decades to centuries — fast enough to be felt within one lifetime",
  groundingMechanic: "Conjunctural pressure is grounded through its effects on daily economic and social life: what things cost, what is available, who has power over whom, what is newly possible and what has recently become impossible or dangerous.",
  detailStrategy: "Specific price data, specific social prohibitions or permissions, specific institutional changes that affect this character's daily life. Not 'the Renaissance was beginning' but 'the guild that had controlled the trade for two hundred years was losing its power to the new merchant families, and the old masters were frightened, and the apprentices could feel it.'",
  writingDirectives: [
    "The conjunctural forces should appear through their effects on the character's daily life, not as historical narration",
    "Characters feel conjunctural change as personal: 'bread is too expensive now' not 'there is an economic crisis'",
    "The conjuncture creates specific possibilities and prohibitions that shape the scene's options",
    "Characters who have lived through the change and characters who are new to it experience it differently",
    "The conjuncture's direction (things getting better or worse for this class of person) is always present as pressure",
  ],
  failureModes: [
    "Historical context delivered as lecture or exposition rather than lived economic and social reality",
    "The conjuncture is vague 'historical atmosphere' rather than specific pressures on this character",
    "Characters who speak about their historical moment as if describing it from outside rather than living inside it",
    "The conjunctural forces do not affect the scene's specific events and options",
  ],
  systemDirectives: [
    "Every historical scene operates within a specific conjunctural moment — establish its direction: is this class of person's situation improving or worsening this decade?",
    "The conjunctural forces should create at least one specific constraint or possibility that shapes what is available in this scene",
    "Characters speak from inside the conjuncture without naming it as such",
    "The tension between the longue durée (permanent) and the conjuncture (changing) is always available as dramatic material",
  ],
  writingNotes: "The conjuncture is what makes a story set in 1517 different from a story set in 1490. The same characters, the same longue durée, but the conjunctural shift of the Reformation's beginning makes the world a different place. Writing the conjuncture means writing the specific texture of a specific decade, not a generic 'historical period.'"
};

export const MICROHISTORY_MOMENT: HistoricalArchetype = {
  name: "Microhistory Moment",
  theoreticalBasis: "Carlo Ginzburg's microhistory methodology (The Cheese and the Worms, 1976): take one exceptionally documented small case and apply Clifford Geertz's thick description: not just recording events but reconstructing the entire web of cultural meaning within which the events made sense to the people living them. The small case illuminates the large forces. Ginzburg's finding: a 16th-century miller's cosmology was not an aberration but a creative synthesis of popular oral culture with fragments of heterodox written culture, revealing layers of historical experience completely invisible to grand narrative.",
  coreDescription: "The scene that looks small but is actually a window into the large forces that would otherwise be invisible. Not a dramatic historical event — a domestic argument, a commercial transaction, a judicial proceeding — that contains the full weight of a historical moment's contradictions and pressures.",
  temporalLayer: "The événement — the individual scale — but specifically chosen to illuminate the conjuncture and longue durée beneath it",
  groundingMechanic: "The microhistory moment is grounded through the specific density of a small event: every word, gesture, object, and exchange containing multiple layers of meaning. The notary's record that accidentally reveals what the parties were trying to conceal. The inventory of a modest household that shows the entire economic logic of its world.",
  detailStrategy: "The detail that is too specific to be invented — the detail that could only exist because someone actually recorded it. The exact price. The exact word used and the specific reason that word and not another. Ginzburg's method: read the silences as carefully as the statements.",
  writingDirectives: [
    "Choose a small scene — a transaction, a conversation, a proceeding — that contains the era's contradictions in miniature",
    "Every detail should be loadable with meaning that reflects the larger structures: this object here for this reason at this price",
    "The gaps and silences in the scene are as meaningful as the stated content",
    "The scene does not announce its significance — the reader finds the larger forces through the specific small ones",
    "Geertz's thick description: the web of cultural meaning within which these events made sense to these people",
  ],
  failureModes: [
    "The 'small scene' is actually a conventional drama with historical costumes",
    "The significance is announced by the narrator rather than emerging from the specific dense detail",
    "The cultural meaning web is absent — characters behave in ways that would make sense to a modern reader without translation",
    "The scene's relationship to the larger historical forces is made explicit rather than embedded",
  ],
  systemDirectives: [
    "Choose the densest possible small moment — the one that contains the most historical texture in the least space",
    "Build the web of cultural meaning: what does this object/word/gesture mean to these people in this specific moment?",
    "The gaps are meaningful: what is not said, not recorded, not present? What would normally be here and isn't?",
    "The reader should be able to reconstruct the larger historical forces from this small window without being told what to find",
  ],
  writingNotes: "The microhistory moment is the technique that makes historical fiction feel like discovery rather than recreation. The writer who has found the right small window can make an entire historical world visible through it."
};

export const MATERIAL_REALITY: HistoricalArchetype = {
  name: "Material Reality",
  theoreticalBasis: "The history of everyday life (Alltagsgeschichte) — the turn in historical scholarship toward the material conditions of ordinary existence rather than political or intellectual history alone. What things cost in terms of labor and time. What the body endured. E.P. Thompson's history from below: the experience of historical change from the perspective of those who lived it. The key methodological principle: historical people were not simply less informed versions of modern people — they inhabited a materially different world with different cognitive and bodily relationships to that world.",
  coreDescription: "The scene grounded in the specific material costs and textures of historical existence. Not the drama or politics of the period — the weight of things, the cost of light, the distance between places, the physical demands of ordinary work. The material reality is the layer that most historical fiction omits and that, when present, makes all the difference.",
  temporalLayer: "Operates primarily within the longue durée and conjuncture simultaneously — permanent material conditions plus the specific material circumstances of this decade",
  groundingMechanic: "Material reality is grounded through the body's specific experience of specific tasks: the weight of the specific object carried, the specific caloric demand of the specific work, the specific time required for the specific journey, the specific cost of the specific commodity relative to the specific wage.",
  detailStrategy: "Specific measurements and costs. This much grain costs this much labor, this distance took this many days on this type of road in this season, this type of illumination lasted this long and cost this much. The specificity is not decorative — it is the argument about what historical life was.",
  writingDirectives: [
    "Write the body's specific experience of specific material tasks — not 'he worked hard' but what the work physically demanded",
    "Every technology implies its material conditions: fire requires tending; light after dark has cost; cold requires management",
    "Distance is time, and historical travel time is almost always longer than modern assumptions produce",
    "The material cost of things (in labor, time, coin, physical effort) must be present even when not foregrounded",
    "Historical people were not pre-modern moderns — their bodies and minds were shaped by different material conditions",
  ],
  failureModes: [
    "Historical characters move through their world with modern ease and convenience",
    "The scene has period-appropriate events and dialogue floating above invisibly modernized material conditions",
    "The cost, weight, distance, and physical demand of historical life are absent",
    "Characters have access to things (information, food variety, light, warmth, speed) that their world did not provide",
  ],
  systemDirectives: [
    "Before writing: what does it physically cost to do what these characters are doing in this time and place?",
    "At least one material detail must be present that a modern reader would not expect",
    "The body's relationship to its material world should be present, not abstracted away",
    "Characters do not comment on their material conditions — they are inside them",
  ],
  writingNotes: "The absence of material reality is the most common and the most debilitating failure in historical fiction. Characters who never feel hungry, never feel cold, never calculate the cost of light — they are historical costumes over modern bodies."
};

export const CULTURAL_SCRIPT: HistoricalArchetype = {
  name: "Cultural Script",
  theoreticalBasis: "Clifford Geertz's thick description and the concept of culture as a web of meanings within which human behavior is intelligible. The cultural script is the set of available roles, interpretations, and responses that a culture makes accessible to its members — the scenarios that make sense, the gestures that carry meaning, the social performances that everyone in the culture knows how to read. The historian's task, and the historical novelist's task, is to reconstruct the cultural script of a specific time and place.",
  coreDescription: "The scene in which characters follow, break, or renegotiate the cultural scripts of their specific historical moment — the available roles, rituals, gestures, and interpretations that structure social behavior in this time and place. The characters are not consciously performing scripts; they are living inside meaning-systems that are so natural to them they are invisible.",
  temporalLayer: "Primarily conjunctural — cultural scripts change with decades and generations, though shaped by the longue durée beneath them",
  groundingMechanic: "The cultural script is grounded by identifying the specific rituals, roles, and meaning-systems of this time and place and writing characters who inhabit them naturally. Not characters who perform their culture for the benefit of modern readers, but characters for whom their cultural forms are simply how things are.",
  detailStrategy: "The specific gesture that carries meaning in this culture. The ritual that everyone present knows is being performed, though its surface appears informal. The role being claimed or contested through specific words and actions. The meaning that is obvious to every period-appropriate observer and invisible to a modern one.",
  writingDirectives: [
    "Characters inhabit their cultural scripts naturally — they do not explain or comment on their own cultural forms",
    "The meaning of gestures, rituals, and roles is legible to other period characters without explanation",
    "A modern reader unfamiliar with the cultural script should feel the density of the meaning even if they cannot fully decode it",
    "Cultural scripts that are being violated are the most dramatically interesting — and the violation is always costly",
    "The same event can mean radically different things within different cultural scripts — write the specific meaning of this culture",
  ],
  failureModes: [
    "Cultural forms are explained to the reader through characters who would not need to explain them to each other",
    "Characters behave in ways that make sense to modern readers but would be socially unintelligible to their contemporaries",
    "The cultural script is generic 'the past' rather than specific to this culture, class, and moment",
    "Characters are modern consciousnesses in historical clothing rather than historically specific subjects",
  ],
  systemDirectives: [
    "Identify the specific cultural scripts in play in this scene: what roles are available, what gestures carry meaning, what rituals structure this interaction?",
    "Characters follow the scripts naturally without naming them",
    "At least one moment where the cultural script constrains or enables something that would be different in a modern setting",
    "The violation of a cultural script must carry the specific cost that this culture's violation entails",
  ],
  writingNotes: "The cultural script is what makes historical characters feel genuinely other rather than simply older. The novelist who knows those scripts can write characters who feel genuinely historical. The novelist who doesn't writes the same modern psychology in different costumes."
};
