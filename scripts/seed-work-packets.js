// Direct DB seed script — reads .env.local, no HTTP/auth needed
require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const SEEDED_WORK_PACKETS = [
  {
    title: "Parasite",
    creator: "Bong Joon-ho",
    medium: "film",
    genres: ["Thriller", "Drama", "Dark Comedy"],
    thematicCore: "Class is not a moral category — it is a structural trap that deforms everyone inside it, including those who appear to escape.",
    craftPrinciples: [
      { principle: "Every object in a class-conscious story carries economic weight. The peach, the stone, the smell — each is a class marker before it is a plot device.", example: "The Scholar's Rock (suseok) — decorative for the Parks, literally lethal in the hands of those who cannot afford metaphor.", applicableTo: ["write", "atmosphere", "brainstorm"] },
      { principle: "Dramatic irony works best when the audience knows something will go wrong before the characters allow themselves to know it.", example: "The garden party scene — the audience sees the returning housekeeper on the monitor before the family does. The dread is front-loaded.", applicableTo: ["tension", "write"] },
      { principle: "Let genre shift happen through architecture, not announcement. The same house contains a dark comedy, a thriller, and a tragedy — what changes is the floor you're on.", example: "The flooding basement sequence — pure disaster realism in the same space that hosted farce an hour earlier.", applicableTo: ["brainstorm", "write", "atmosphere"] },
    ],
  },
  {
    title: "Vinland Saga",
    creator: "Makoto Yukimura",
    medium: "manga",
    genres: ["Historical Fiction", "Action", "Drama"],
    thematicCore: "The warrior's code is a seductive lie. True strength is refusing to fight — and the story earns this thesis by first making us love violence alongside its protagonist.",
    craftPrinciples: [
      { principle: "Let your protagonist hold the wrong worldview with full conviction for long enough that the reader adopts it too. The reversal must cost both the character and the reader something.", example: "Thorfinn's decade of revenge — we root for him even as Askeladd is more interesting. The cost lands when the revenge arrives hollow.", applicableTo: ["brainstorm", "write", "emotional"] },
      { principle: "The antagonist who is right about everything except the most important thing is more devastating than one who is simply evil.", example: "Askeladd understands power, history, and strategy with perfect clarity — and uses this clarity to do monstrous things he justifies with perfect logic.", applicableTo: ["brainstorm", "dialogue"] },
      { principle: "A farm arc after an action arc is not a detour — it is the thesis made literal. Put your protagonist somewhere that removes their identity and see what remains.", example: "The Farmland Saga — Thorfinn on Ketil's farm, learning to exist without violence as identity.", applicableTo: ["brainstorm", "write"] },
    ],
  },
  {
    title: "Breaking Bad",
    creator: "Vince Gilligan",
    medium: "tv",
    genres: ["Drama", "Crime", "Thriller"],
    thematicCore: "Pride disguised as pragmatism is the engine of self-destruction. Walter White never needed money — he needed to feel exceptional.",
    craftPrinciples: [
      { principle: "A protagonist's flaw and their strength are the same thing. The capacity for denial that makes Walter a survivor is identical to the capacity for denial that makes him a monster.", example: "Walter's chemistry genius enables both the cancer treatment fundraising lie and the empire — same cognitive pattern, different moral register.", applicableTo: ["brainstorm", "write", "emotional"] },
      { principle: "Show the cost of every victory. Each win in the criminal world must carry visible damage — to relationships, to conscience, to the protagonist's face.", example: "Each season finale leaves Walter more successful and more alone. The victories are legible as losses.", applicableTo: ["write", "brainstorm"] },
      { principle: "Use cold opens that recontextualize the entire episode — the audience is always in a different time than they think they are.", example: "The Tuco cold open, the pink bear sequence — the show's present tense is always haunted by its future.", applicableTo: ["brainstorm", "tension"] },
    ],
  },
  {
    title: "My Mister",
    creator: "Park Hae-young",
    medium: "tv",
    genres: ["Drama", "Literary Fiction"],
    thematicCore: "Witnessing someone's pain without rescuing them from it is a form of love that most fiction mistakes for passivity.",
    craftPrinciples: [
      { principle: "Two characters can share profound intimacy while remaining in different moral registers — the audience must hold both without resolving the tension.", example: "Ji-an surveils Dong-hoon to destroy him, then to protect him. Her care and her surveillance are the same act.", applicableTo: ["write", "emotional", "dialogue"] },
      { principle: "Interiority can be externalised through sound alone. A character listening to another character's ordinary day is more intimate than any declaration.", example: "Ji-an listening to Dong-hoon's phone through the bug — the mundane family conversation as the most emotionally loaded scene in the series.", applicableTo: ["emotional", "atmosphere", "write"] },
    ],
  },
  {
    title: "One Piece",
    creator: "Eiichiro Oda",
    medium: "manga",
    genres: ["Adventure", "Fantasy", "Comedy"],
    thematicCore: "A crew is not a family you're born into — it is one you build through shared commitment to something larger than any individual goal.",
    craftPrinciples: [
      { principle: "Foreshadow across decades, not chapters. The reader's trust is earned by details that pay off years later — not months.", example: "Laugh Tale, the Will of D, the Void Century — seeded in early arcs, unresolved for 25 years, gaining weight with every non-answer.", applicableTo: ["brainstorm", "write"] },
      { principle: "A villain's backstory doesn't excuse them — it makes their choice to be monstrous more tragic. Show exactly where the path diverged.", example: "Doflamingo's origin — the backstory earns him complexity without softening his capacity for cruelty.", applicableTo: ["brainstorm", "emotional"] },
    ],
  },
  {
    title: "Mob Psycho 100",
    creator: "ONE",
    medium: "manga",
    genres: ["Action", "Comedy", "Coming-of-age"],
    thematicCore: "Power is only as meaningful as the emotional development of the person who holds it. A protagonist who cannot feel is not strong — they are incomplete.",
    craftPrinciples: [
      { principle: "Undercut spectacle with sincerity. The funniest and most emotionally resonant moments occupy the same space — the comedy is not relief from the emotion, it is the emotion's delivery vehicle.", example: "Mob's 100% emotional readings — the absurd percentage counter attached to genuine psychological crisis.", applicableTo: ["comedy", "emotional", "write"] },
      { principle: "Let the mentor be wrong in the way the protagonist most needs them to be wrong. The lesson the student learns must be one the mentor cannot teach.", example: "Reigen genuinely believes his own con — Mob's growth requires outgrowing Reigen's worldview while still loving him.", applicableTo: ["brainstorm", "dialogue"] },
    ],
  },
  {
    title: "Chainsaw Man",
    creator: "Tatsuki Fujimoto",
    medium: "manga",
    genres: ["Action", "Dark Fantasy", "Horror"],
    thematicCore: "Desire is the only honest thing in a world designed to exploit it — but following desire without wisdom is its own form of annihilation.",
    craftPrinciples: [
      { principle: "Kill characters the audience has been trained to love at the moment of maximum trust. The grief is proportional to the investment — do not protect your reader.", example: "Aki's fate — the character built over two arcs, killed in a chapter that begins as an ordinary scene.", applicableTo: ["write", "tension", "horror"] },
      { principle: "The simplest protagonist goal (bread, a normal life) becomes tragic when placed in a world that structurally prevents it. No villain required — the system is enough.", example: "Denji wants toast and a girlfriend. The tragedy is that these wants are genuinely unreachable given his circumstances.", applicableTo: ["brainstorm", "write"] },
    ],
  },
  {
    title: "Attack on Titan",
    creator: "Hajime Isayama",
    medium: "manga",
    genres: ["Dark Fantasy", "Action", "Historical Fiction"],
    thematicCore: "Every side believes it is the protagonist of a story about survival. The horror is that all of them are right.",
    craftPrinciples: [
      { principle: "Reframe the reader's entire moral orientation by showing the same events from the other side. Not as a twist — as a structural commitment to perspectivism.", example: "The Marley arc — every assumption about the first 50 chapters is recontextualized without a single retcon.", applicableTo: ["brainstorm", "write"] },
      { principle: "Let a protagonist's righteous rage carry them all the way to the end of its logic. Do not pull back when the destination becomes uncomfortable.", example: "Eren's full arc — the rage that made him heroic, followed to its conclusion, produces the thing he was fighting.", applicableTo: ["brainstorm", "write", "emotional"] },
    ],
  },
  {
    title: "True Detective Season 1",
    creator: "Nic Pizzolatto",
    medium: "tv",
    genres: ["Mystery", "Thriller", "Literary Fiction"],
    thematicCore: "The detective story is a frame for examining what a man becomes when he has stared into meaninglessness long enough to see a face there.",
    craftPrinciples: [
      { principle: "Two investigators who represent incompatible worldviews will generate more tension in their car than most thrillers generate in their action sequences.", example: "Rust and Marty's dialogue in the car — the mystery is almost secondary to the philosophical argument that runs underneath it.", applicableTo: ["dialogue", "tension", "write"] },
      { principle: "A villain revealed too late to be a real character is not a satisfying antagonist — but the mystery around them can carry a whole season if the atmosphere is sustained.", example: "The Yellow King — the atmospheric dread is the story; the monster behind it is almost irrelevant.", applicableTo: ["mystery", "atmosphere", "horror"] },
    ],
  },
  {
    title: "My Brilliant Friend (Neapolitan Novels)",
    creator: "Elena Ferrante",
    medium: "novel",
    genres: ["Literary Fiction", "Drama"],
    thematicCore: "Female friendship is the site of both the deepest love and the deepest violence — because it is where ambition, resentment, and admiration become indistinguishable.",
    craftPrinciples: [
      { principle: "Write a friendship in which both parties are simultaneously protagonist and antagonist of each other's story. The reader should be unable to fully side with either.", example: "Elena and Lila — every act of support contains an element of competition; every cruelty contains an element of love.", applicableTo: ["write", "emotional", "brainstorm"] },
      { principle: "Let setting carry class anxiety. The neighborhood is not backdrop — it is a character with its own memory, threat, and escape routes.", example: "The rione — every scene in the neighborhood is saturated with the knowledge of what it costs to leave and what it costs to stay.", applicableTo: ["atmosphere", "write"] },
    ],
  },
  {
    title: "Grave of the Fireflies",
    creator: "Isao Takahata",
    medium: "film",
    genres: ["Drama", "Historical Fiction"],
    thematicCore: "War's most honest record is not the battlefield — it is what happens to children when the systems that protect them collapse.",
    craftPrinciples: [
      { principle: "Announce the ending before the story begins. The audience's grief is not diminished by knowing — it is deepened because they must watch the tenderness knowing what it costs.", example: "The film opens with Seita's death. Every scene of the children's happiness is viewed through this lens.", applicableTo: ["write", "emotional", "brainstorm"] },
      { principle: "Small joys are the most devastating emotional material in tragedy. A candy tin. A firefly. These are the things that survive annihilation in memory.", example: "The fruit drops tin — an object that accumulates grief with every appearance.", applicableTo: ["emotional", "atmosphere", "write"] },
    ],
  },
  {
    title: "The Wire",
    creator: "David Simon",
    medium: "tv",
    genres: ["Drama", "Crime", "Literary Fiction"],
    thematicCore: "Institutions are not corrupted by bad individuals — they corrupt individuals by demanding loyalty to the institution over loyalty to truth.",
    craftPrinciples: [
      { principle: "Let the system be the antagonist and show it defeating well-intentioned people without malice — simply through structural logic.", example: "Bunny Colvin's Hamsterdam — a rational solution destroyed not by villains but by political mechanics that require visible wins over actual outcomes.", applicableTo: ["brainstorm", "write"] },
      { principle: "Give your most morally compromised characters coherent internal codes. The criminal who will not harm children is not softened — he is complicated in a way that indicts the audience's easy judgments.", example: "Omar's code — he robs drug dealers, witnesses against them, and has more honor than most of the police pursuing him.", applicableTo: ["brainstorm", "dialogue", "write"] },
    ],
  },
  {
    title: "Neon Genesis Evangelion",
    creator: "Hideaki Anno",
    medium: "tv",
    genres: ["Sci-Fi", "Drama", "Psychological Horror"],
    thematicCore: "A boy asked to save the world who cannot save himself is not a hero — he is a symptom of what we ask of the least equipped among us.",
    craftPrinciples: [
      { principle: "Deconstruct the genre's wish fulfillment by following its logic to its psychological consequences. What does it actually do to a child to be the chosen one?", example: "Shinji's piloting — the mecha fantasy made literal, and then the trauma of what that would actually mean.", applicableTo: ["brainstorm", "emotional", "write"] },
    ],
  },
  {
    title: "The Left Hand of Darkness",
    creator: "Ursula K. Le Guin",
    medium: "novel",
    genres: ["Sci-Fi", "Literary Fiction"],
    thematicCore: "The defamiliarization of gender reveals how much of what we believe to be personality is actually the performance of a biological category.",
    craftPrinciples: [
      { principle: "World-building through subtraction is more powerful than through addition. Remove one element from human experience and observe everything that restructures around its absence.", example: "Remove fixed gender — then follow what happens to politics, intimacy, war, religion, and loyalty.", applicableTo: ["brainstorm", "write", "atmosphere"] },
    ],
  },
  {
    title: "Spirited Away",
    creator: "Hayao Miyazaki",
    medium: "film",
    genres: ["Fantasy", "Coming-of-age"],
    thematicCore: "Identity is not what you are given — it is what you remember when everything that defines you has been taken.",
    craftPrinciples: [
      { principle: "In a child protagonist story, do not simplify the world to the child's level — complicate the child to meet the world. The audience will follow.", example: "Chihiro does not understand the spirit world. She learns its rules through labor, not explanation.", applicableTo: ["write", "brainstorm", "atmosphere"] },
      { principle: "Labor as narrative — what a character does with their hands tells you what they are. Give protagonists work that has consequences.", example: "Chihiro's job at the bathhouse — cleaning, serving, learning hierarchy — is the entire character arc made physical.", applicableTo: ["write", "brainstorm"] },
    ],
  },
  {
    title: "Blood Meridian",
    creator: "Cormac McCarthy",
    medium: "novel",
    genres: ["Literary Fiction", "Historical Fiction", "Horror"],
    thematicCore: "Violence is not a deviation from human history — it is the event that history is built around, and war is its sacrament.",
    craftPrinciples: [
      { principle: "An antagonist who articulates the theme better than the narrative does is more terrifying than one who simply enacts it.", example: "Judge Holden's philosophy — he is not wrong about violence, which is what makes him irreducible.", applicableTo: ["brainstorm", "dialogue"] },
      { principle: "Refuse interpretation. A narrative that offers no moral resolution forces the reader to become the site of meaning-making — which is more disturbing than any authorial verdict.", example: "The ending of Blood Meridian — no justice, no explanation, no comfort. The reader must decide what the Kid's death means.", applicableTo: ["write", "brainstorm"] },
    ],
  },
  {
    title: "Oldboy",
    creator: "Park Chan-wook",
    medium: "film",
    genres: ["Thriller", "Mystery", "Drama"],
    thematicCore: "A mystery whose solution is worse than ignorance — and the villain who manufactures this situation is more honest about trauma's logic than any hero.",
    craftPrinciples: [
      { principle: "Design your mystery so that the answer retroactively changes the meaning of everything the audience has already seen. Not through deception — through reframing.", example: "The corridor fight, the ants, the hypnosis — all recontextualized by the final revelation without a single lie being told.", applicableTo: ["mystery", "tension", "brainstorm"] },
    ],
  },
  {
    title: "Flowers for Algernon",
    creator: "Daniel Keyes",
    medium: "novel",
    genres: ["Sci-Fi", "Literary Fiction", "Drama"],
    thematicCore: "Intelligence does not confer happiness — it confers the capacity to understand your own suffering with greater precision.",
    craftPrinciples: [
      { principle: "Let form embody character state. The prose style of a first-person narrator should change as the narrator changes — not as stylistic flourish, but as necessity.", example: "Charlie's progress reports — early misspellings and fragmented syntax, late entries of devastating lucidity, then the regression. Form IS content.", applicableTo: ["write", "brainstorm"] },
    ],
  },
];

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  let inserted = 0;
  let skipped = 0;

  for (const packet of SEEDED_WORK_PACKETS) {
    // Check if already exists by title
    const existing = await sql`SELECT id FROM work_packets WHERE title = ${packet.title} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  SKIP  ${packet.title}`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO work_packets
        (title, creator, medium, genres, craft_principles, thematic_core, user_id, is_public, status)
      VALUES
        (${packet.title}, ${packet.creator}, ${packet.medium},
         ${JSON.stringify(packet.genres)}, ${JSON.stringify(packet.craftPrinciples)},
         ${packet.thematicCore}, ${null}, ${true}, ${'active'})
    `;
    console.log(`  INSERT ${packet.title}`);
    inserted++;
  }

  console.log(`\nDone — inserted: ${inserted}, skipped: ${skipped}, total: ${SEEDED_WORK_PACKETS.length}`);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
