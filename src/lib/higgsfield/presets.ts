// src/lib/higgsfield/presets.ts
// Camera preset and viral preset catalogs for Higgsfield video generation.

export interface CameraPreset {
  id: string;
  label: string;
  description: string;
  promptInjection: string;
  bestFor: string[];
}

export interface CameraPresetGroup {
  label: string;
  presets: CameraPreset[];
}

export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  bullet_time: {
    id: "bullet_time",
    label: "Bullet Time",
    description: "Camera orbits around a frozen or ultra-slow moment",
    promptInjection: "BULLET TIME CAMERA: Ultra-slow motion, camera rotates 360 degrees around subject, matrix-style freeze frame effect, time appears suspended",
    bestFor: ["combat", "action", "climax"],
  },
  slow_motion: {
    id: "slow_motion",
    label: "Slow Motion",
    description: "High-speed capture, dramatic slow playback",
    promptInjection: "SLOW MOTION: 120fps slow motion effect, every detail visible, fluid movement, cinematic high-speed photography",
    bestFor: ["combat", "emotional", "sports"],
  },
  speed_ramp: {
    id: "speed_ramp",
    label: "Speed Ramp",
    description: "Speed changes from fast to slow at the key moment",
    promptInjection: "SPEED RAMP: Camera starts at normal speed, dramatically decelerates to slow motion at the critical moment, then accelerates back",
    bestFor: ["action", "combat", "thriller"],
  },
  crash_zoom: {
    id: "crash_zoom",
    label: "Crash Zoom",
    description: "Sudden aggressive zoom into subject",
    promptInjection: "CRASH ZOOM: Rapid aggressive punch zoom into subject, handheld energy, immediate impact, urgency and chaos",
    bestFor: ["horror", "action", "comedy", "thriller"],
  },
  dolly_zoom: {
    id: "dolly_zoom",
    label: "Dolly Zoom (Vertigo Effect)",
    description: "Camera pulls back while zoom tightens — world warps",
    promptInjection: "DOLLY ZOOM VERTIGO EFFECT: Camera physically moves away from subject while zoom lens tightens simultaneously, creating disorienting spatial distortion, Hitchcock vertigo effect",
    bestFor: ["horror", "psychological", "thriller"],
  },
  tracking_shot: {
    id: "tracking_shot",
    label: "Tracking Shot",
    description: "Camera follows subject smoothly through space",
    promptInjection: "SMOOTH TRACKING SHOT: Camera moves fluidly alongside or behind subject, maintaining frame, cinematic steadicam movement",
    bestFor: ["action", "drama", "combat"],
  },
  dutch_angle: {
    id: "dutch_angle",
    label: "Dutch Angle / Canted",
    description: "Camera tilted for psychological unease",
    promptInjection: "DUTCH ANGLE: Camera tilted 15-30 degrees, canted framing creates psychological tension and unease, disorienting composition",
    bestFor: ["horror", "thriller", "psychological"],
  },
  rotation_360: {
    id: "rotation_360",
    label: "360° Rotation",
    description: "Camera orbits completely around subject",
    promptInjection: "360 DEGREE ROTATION: Camera orbits fully around subject, smooth circular movement, subject remains centered, dramatic reveal of environment",
    bestFor: ["action", "epic", "combat"],
  },
  orbital: {
    id: "orbital",
    label: "Orbital",
    description: "Camera arcs around subject at distance",
    promptInjection: "ORBITAL CAMERA: Wide sweeping arc around subject, epic scale, environment revealed progressively",
    bestFor: ["epic", "cosmic", "establishing"],
  },
  drone_aerial: {
    id: "drone_aerial",
    label: "Drone Aerial",
    description: "High altitude aerial perspective descending in",
    promptInjection: "DRONE AERIAL SHOT: Camera descends from high altitude, aerial perspective, sweeping landscape visible, cinematic establishing drone footage",
    bestFor: ["establishing", "epic", "atmosphere"],
  },
  extreme_close_up: {
    id: "extreme_close_up",
    label: "Extreme Close-Up",
    description: "Fills frame with a single detail — eye, hand, object",
    promptInjection: "EXTREME CLOSE-UP ECU: Single detail fills entire frame, shallow depth of field, intense intimacy, micro-detail visible",
    bestFor: ["emotional", "thriller", "horror"],
  },
  pov: {
    id: "pov",
    label: "POV (First Person)",
    description: "Camera as character's eyes",
    promptInjection: "FIRST PERSON POV: Camera perspective from character's eye level, immersive first-person view, slight handheld movement",
    bestFor: ["action", "horror", "thriller"],
  },
  over_the_shoulder: {
    id: "over_the_shoulder",
    label: "Over the Shoulder",
    description: "Camera behind and above character's shoulder",
    promptInjection: "OVER THE SHOULDER SHOT: Camera positioned behind and over character's shoulder, other character or subject visible in foreground",
    bestFor: ["dialogue", "confrontation", "thriller"],
  },
  handheld_chaos: {
    id: "handheld_chaos",
    label: "Handheld Chaos",
    description: "Shaky, immersive, documentary feel",
    promptInjection: "HANDHELD CAMERA: Shaky handheld movement, documentary-style, raw and immediate energy, realistic imperfection",
    bestFor: ["action", "horror", "combat", "street"],
  },
  found_footage: {
    id: "found_footage",
    label: "Found Footage",
    description: "As if recorded by a character in the scene",
    promptInjection: "FOUND FOOTAGE STYLE: Camera appears to be held by someone in the scene, raw shaky footage, VHS grain texture, realistic imperfection, low-fi recording quality",
    bestFor: ["horror", "thriller"],
  },
  whip_pan: {
    id: "whip_pan",
    label: "Whip Pan",
    description: "Rapid horizontal pan causing motion blur",
    promptInjection: "WHIP PAN: Ultra-fast horizontal pan with motion blur, kinetic energy, transitions between subjects with speed",
    bestFor: ["action", "comedy", "montage"],
  },
  rack_focus: {
    id: "rack_focus",
    label: "Rack Focus",
    description: "Shifts focus between foreground and background subjects",
    promptInjection: "RACK FOCUS: Focus shifts between foreground and background subjects, bokeh transitions, cinematic depth shift",
    bestFor: ["drama", "dialogue", "emotional"],
  },
  time_lapse: {
    id: "time_lapse",
    label: "Time-Lapse",
    description: "Compressed time, movement accelerated",
    promptInjection: "TIME LAPSE: Accelerated time, compressed motion, clouds moving fast, daylight changing, urban movement blurred",
    bestFor: ["atmosphere", "establishing", "transitions"],
  },
  night_vision: {
    id: "night_vision",
    label: "Night Vision",
    description: "Green-tinted thermal/night vision aesthetic",
    promptInjection: "NIGHT VISION CAMERA: Green monochrome thermal/night-vision filter, grainy texture, surveillance aesthetic, darkness revealed in green",
    bestFor: ["thriller", "horror", "military"],
  },
};

export const CAMERA_PRESET_GROUPS: CameraPresetGroup[] = [
  {
    label: "Slow Motion",
    presets: [CAMERA_PRESETS.bullet_time, CAMERA_PRESETS.slow_motion, CAMERA_PRESETS.speed_ramp],
  },
  {
    label: "Dynamic Movement",
    presets: [CAMERA_PRESETS.crash_zoom, CAMERA_PRESETS.dolly_zoom, CAMERA_PRESETS.tracking_shot, CAMERA_PRESETS.dutch_angle],
  },
  {
    label: "Rotation & Orbit",
    presets: [CAMERA_PRESETS.rotation_360, CAMERA_PRESETS.orbital, CAMERA_PRESETS.drone_aerial],
  },
  {
    label: "Classic Cinematic",
    presets: [CAMERA_PRESETS.extreme_close_up, CAMERA_PRESETS.pov, CAMERA_PRESETS.over_the_shoulder, CAMERA_PRESETS.rack_focus],
  },
  {
    label: "Handheld & Raw",
    presets: [CAMERA_PRESETS.handheld_chaos, CAMERA_PRESETS.found_footage],
  },
  {
    label: "Specialty",
    presets: [CAMERA_PRESETS.whip_pan, CAMERA_PRESETS.time_lapse, CAMERA_PRESETS.night_vision],
  },
];

// ── Viral Presets ─────────────────────────────────────────────────────────────

export interface ViralPreset {
  id: string;
  label: string;
  description: string;
  promptInjection: string;
  genres: string[];
  modes: string[];
}

export const VIRAL_PRESETS: ViralPreset[] = [
  {
    id: "kung_fu_hit",
    label: "Kung Fu Hit",
    description: "Martial arts impact with dramatic slow-motion freeze",
    promptInjection: "KUNG FU HIT PRESET: Martial arts combat, dramatic impact freeze, motion blur on strikes, powerful kinetic energy, Bruce Lee aesthetic",
    genres: ["action", "martial_arts"],
    modes: ["combat"],
  },
  {
    id: "dragon_fantasy",
    label: "Dragon Fantasy",
    description: "Epic fantasy with dragon and magical elements",
    promptInjection: "DRAGON FANTASY PRESET: Epic fantasy world, dragon in frame, magical atmosphere, golden hour lighting, cinematic fantasy epic scale",
    genres: ["fantasy"],
    modes: ["combat", "atmosphere"],
  },
  {
    id: "soul_fighter",
    label: "Soul Fighter",
    description: "Street fighter style combat with energy effects",
    promptInjection: "SOUL FIGHTER PRESET: Street fighter combat aesthetics, energy auras, dramatic lighting, arena battle, neon-lit urban environment",
    genres: ["action", "sci-fi"],
    modes: ["combat"],
  },
  {
    id: "arena_zero",
    label: "Arena Zero",
    description: "Gladiatorial arena combat, ancient-modern fusion",
    promptInjection: "ARENA ZERO PRESET: Gladiatorial combat arena, ancient-modern aesthetic, crowd energy, dramatic arena lighting, combat spectacle",
    genres: ["action", "historical"],
    modes: ["combat"],
  },
  {
    id: "frozen_monster",
    label: "Frozen Monster",
    description: "Horror creature in frozen/arctic environment",
    promptInjection: "FROZEN MONSTER PRESET: Horror creature emerging from ice/snow, arctic environment, frozen atmosphere, creature horror aesthetic",
    genres: ["horror"],
    modes: ["horror"],
  },
  {
    id: "zombie_dance",
    label: "Zombie Dance",
    description: "Undead movement with horror-comedy energy",
    promptInjection: "ZOMBIE DANCE PRESET: Undead character movement, horror-comedy aesthetic, deteriorated appearance, jerky movements, dark humor energy",
    genres: ["horror", "comedy"],
    modes: ["horror", "comedy"],
  },
  {
    id: "drift_racing",
    label: "Drift Racing",
    description: "High-speed car chase with cinematic racing aesthetics",
    promptInjection: "DRIFT RACING PRESET: High-speed vehicle chase, tire smoke, neon city lights, cinematic racing angle, adrenaline speed",
    genres: ["action", "thriller"],
    modes: ["tension"],
  },
  {
    id: "cgi_breakdown",
    label: "CGI Breakdown",
    description: "Wireframe overlay revealing digital construction",
    promptInjection: "CGI BREAKDOWN PRESET: Digital wireframe overlays reveal construction beneath surface, holographic blue grid lines, tech aesthetic",
    genres: ["sci-fi"],
    modes: ["atmosphere"],
  },
  {
    id: "baseball_game",
    label: "Baseball Game",
    description: "Sports cinematic with stadium energy",
    promptInjection: "BASEBALL GAME PRESET: Sports stadium atmosphere, cinematic sports photography, crowd energy, field lighting, athletic performance",
    genres: ["sports", "drama"],
    modes: ["tension"],
  },
  {
    id: "red_carpet",
    label: "Red Carpet",
    description: "Glamorous celebrity entrance with paparazzi energy",
    promptInjection: "RED CARPET PRESET: Glamorous celebrity aesthetic, photographer flashes, luxury fashion, dramatic entrance energy",
    genres: ["romance", "drama"],
    modes: ["dialogue"],
  },
  {
    id: "storm_giant",
    label: "Storm Giant",
    description: "Colossal entity against dramatic storm backdrop",
    promptInjection: "STORM GIANT PRESET: Enormous scale entity, dramatic storm atmosphere, lightning, cosmic scale, overwhelming power",
    genres: ["fantasy", "horror", "sci-fi"],
    modes: ["horror", "combat"],
  },
  {
    id: "orbital_presence",
    label: "Orbital Presence",
    description: "Space/orbital establishing with cosmic scale",
    promptInjection: "ORBITAL PRESENCE PRESET: Space orbital perspective, Earth or planet visible below, cosmic scale, weightless environment, stars",
    genres: ["sci-fi"],
    modes: ["atmosphere"],
  },
  {
    id: "viking_voyage",
    label: "Viking Voyage",
    description: "Nordic maritime epic with historical atmosphere",
    promptInjection: "VIKING VOYAGE PRESET: Norse maritime atmosphere, longship on dramatic seas, Nordic warrior aesthetic, historical epic scale",
    genres: ["historical", "action"],
    modes: ["combat", "atmosphere"],
  },
  {
    id: "night_city",
    label: "Night City",
    description: "Cyberpunk neon-drenched urban environment",
    promptInjection: "NIGHT CITY PRESET: Cyberpunk aesthetic, neon lights reflected on wet streets, urban dystopia, rain, holographic advertisements",
    genres: ["sci-fi", "noir"],
    modes: ["atmosphere", "tension"],
  },
  {
    id: "samurai_duel",
    label: "Samurai Duel",
    description: "Katana combat with Japanese aesthetic",
    promptInjection: "SAMURAI DUEL PRESET: Japanese feudal aesthetic, katana combat, cherry blossoms or autumn leaves, dramatic lighting, honorable combat",
    genres: ["historical", "action"],
    modes: ["combat"],
  },
];

export function getRecommendedViralPreset(
  mood: string,
  genre: string,
  activeMode?: string
): ViralPreset | undefined {
  const moodLower = mood.toLowerCase();
  const genreLower = genre.toLowerCase();
  const modeLower = activeMode?.toLowerCase() ?? "";

  const scored = VIRAL_PRESETS.map(p => {
    let score = 0;
    p.genres.forEach(g => { if (genreLower.includes(g) || g.includes(genreLower)) score += 2; });
    p.modes.forEach(m => { if (modeLower.includes(m) || m.includes(modeLower)) score += 3; });
    if (moodLower.includes("epic") && p.id.includes("dragon")) score += 1;
    if (moodLower.includes("horror") && p.genres.includes("horror")) score += 1;
    if (moodLower.includes("fight") && p.modes.includes("combat")) score += 1;
    return { preset: p, score };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.preset : undefined;
}
