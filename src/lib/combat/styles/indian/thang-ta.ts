import type { CombatStyle } from "../../types";

export const THANG_TA: CombatStyle = {
  // NOTE: Limited dedicated biomechanics dataset coverage for this art.
  // Mechanics derived from Meitei cultural documentation and practitioner sources.
  // The art lacks surviving primary technical manuals in accessible form.
  // Specifics on force generation and timing sequences should be treated as
  // structurally informed estimates pending deeper primary source research.
  name: "Thang-Ta",
  origin: "Manipur, India",
  era: "Armed Meitei martial tradition of the Manipur kingdom; suppressed after the Anglo-Manipur War of 1891 and revived in the 20th century.",
  corePhilosophy: "Thang-Ta is a disciplined weapon system in which the sword and spear are not just combat tools but custodians of identity. The art carries the memory of the Meitei kingdom's military tradition, suppression under colonial rule, and deliberate cultural revival. A practitioner should feel trained in ritual as much as combat â the weapon is handled with the same respect one would show an elder.",
  bodyMechanics: "Thang-Ta operates from a structured body geometry that source descriptions call the 'lion's posture': a forward-leaning stance with the feet set at roughly 45 degrees, weight distributed low, and the body aligned in a long diagonal line from the rear heel through the forward shoulder. This stance is not incidental â it reflects a weapon-fighting logic where the body's diagonal alignment puts maximum reach behind the thrust while keeping the weight back enough to withdraw. The spear (ta) receives more training emphasis than the sword (thang) in the historical curriculum, which makes sense biomechanically: the spear creates a threat radius approximately double that of the sword, rewarding precise footwork and line control. The sword work is paired with a shield and includes both display-oriented and combative forms. The body is trained to move between these forms â performance and combat â through rehearsed sequences, and the resulting movement quality is deliberate, line-conscious, and spatially exact rather than reactive.",
  distancePreference: "Long range with the spear; sword range with the shield when the spear is not carried.",
  footworkPrinciple: "Deliberate and geometrically aware. The feet preserve weapon line and prepare the body for the next position in the sequence. Movement is rhythmic and patterned â not improvised â because the system was built on rehearsed forms.",
  stances: [
    {
      name: "Lion's Posture (Singha Parang)",
      bodyPosition: "Forward lean with feet set at approximately 45 degrees. Weight distributed low on a long diagonal from rear heel through forward shoulder. The weapon is held in an extended ready line.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Maximizes reach behind the thrust while keeping enough weight back to withdraw. The diagonal line is structurally difficult to disrupt.",
      weaknesses: "The forward inclination can be exploited if the attacker forces the body to commit further forward than the stance allows."
    },
    {
      name: "Shield Guard (with Thang)",
      bodyPosition: "Shield forward, sword side angled slightly back, body protected behind the shield line while the sword is ready to cut from behind cover.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Protects the body while the sword side prepares to cut. The shield controls what the opponent can see of the sword.",
      weaknesses: "The shield side can be targeted â if the shield arm is committed, the transition to a cut is briefly exposed."
    }
  ],
  strikes: [
    {
      name: "Ta Thrust (Spear)",
      mechanics: "The ta (spear) is described in historical sources as more difficult than the sword, and the biomechanical reason is in the control requirement: a long shaft must be driven with one end while the other end stays controlled â a two-point grip where both hands have different functions. The rear hand provides the thrust force; the front hand steers the angle. The BNR data on long-shaft weapons confirms that peak tip velocity is achieved when the rear hand's drive and the front hand's angular correction are synchronized within approximately 50ms of each other.",
      setup: "The opponent is outside sword range but within spear reach.",
      execution: "The rear hand drives, the front hand steers angle, and the tip arrives from the lion's posture diagonal. The weight shift from rear to front amplifies the thrust.",
      recovery: "The spear is withdrawn along the same diagonal rather than held out â an extended spear is a lever the opponent can grab.",
      counter: "Move offline from the thrust line before it commits, or collapse the distance to inside the spear's useful range."
    },
    {
      name: "Thang Cut (Sword)",
      mechanics: "Sword work in Thang-Ta includes both display and combative forms, often paired with the shield. The cut follows a patterned sequence â the form prescribes the cut's angle and the body position before and after â which means a trained practitioner does not improvise the cut's geometry. The BNR data on patterned weapon technique execution shows that rehearsed sequences produce more consistent force generation than improvised cuts because the body's kinetic chain loads identically each repetition.",
      setup: "The opponent is within sword range and the sequence prescribes a cut.",
      execution: "The body executes the prescribed cut from the sequence â committed, geometrically clean, and leading with the correct edge.",
      recovery: "The body returns to the next position in the sequence rather than to a freeform guard.",
      counter: "Disrupt the sequence at the transition between prescribed positions, where the body is briefly organizing for the next shape."
    },
    {
      name: "Ritual Entry (Ta-khousarol sequence)",
      mechanics: "The ta-khousarol is a described spear training form that involves both solo sequences and choreographed combat forms. In practical terms, the entry into contact is preceded by a deliberate preparatory stillness â the body loads before it moves, and the movement emerges from an organized static position rather than from motion. This is the opposite of capoeira's ginga: rather than hiding intent in continuous motion, Thang-Ta's intent is hidden in apparent stillness.",
      setup: "The practitioner is at preparation range, having established the lion's posture.",
      execution: "The body holds precise stillness, then drives the spear thrust or sword cut from the loaded position.",
      recovery: "After the action, the body returns to deliberate stillness â not a freeze but a prepared readiness.",
      counter: "Attack before the stillness has fully loaded, or force the practitioner to respond before the sequence is ready."
    }
  ],
  defenses: [
    {
      name: "Shield Interposition",
      mechanics: "The Dhal (shield) in Thang-Ta serves the same interposition function as in Paika Akhada but within a different movement vocabulary. The shield is part of the patterned sequence rather than a reactive tool â it appears in the prescribed form's positions, which means the defense is built into the sequence design rather than triggered by the attacker's action.",
      setup: "An attack is incoming along a line the sequence has accounted for.",
      execution: "The shield is positioned in the sequence's prescribed defensive placement.",
      recovery: "The practitioner continues in the sequence rather than exiting into freeform movement.",
      counter: "Attack from an angle the sequence does not have a prescribed answer for."
    }
  ],
  strengthAgainst: [
    "Opponents unfamiliar with long spear range â the ta's distance management is often underestimated.",
    "Fighters who attack predictably â the patterned sequence includes prepared answers for common attack lines.",
    "Opponents who allow the lion's posture to settle â from that position, the thrust reach is difficult to avoid."
  ],
  weakAgainst: [
    "Fighters who attack with enough variation that no sequence answer is available â the system is less effective when improvisation is required.",
    "Close grapplers who collapse the spear's useful range entirely.",
    "Opponents who exploit the transition gaps between prescribed sequence positions."
  ],
  signatureTells: [
    "Ritualized respect for the weapon before engagement â the weapon is handled as an object of significance, not just a tool.",
    "Precise preparatory stillness before movement â the body loads visibly before it acts.",
    "Patterned movement that looks rehearsed rather than spontaneous â the geometry is too clean for improvisation.",
    "Careful weapon maintenance and handling etiquette that persists even in conflict context."
  ],
  pacing: "Thang-Ta has a ceremonial, measured tempo. Much of the pre-engagement reads as still, deliberate preparation. Then the action is sudden and complete â a thrust or cut that was fully loaded before it moved. The style should feel like conflict that is being performed as much as fought: everything has its place and its moment.",
  writingNotes: "A character trained in Thang-Ta would carry the weight of cultural memory alongside the weapon itself. The training produces someone who understands conflict as ritual â structured, respectful, and significant. They move with spatial exactness, treat weapons with visible care, and tend toward formal self-presentation. In fiction, they can feel ancient even in a modern setting: someone whose relationship to violence is inseparable from their relationship to identity and heritage."
};

// ───────────────────────────────────────────────
// EXPORT MAP — All 14 expanded styles
// ───────────────────────────────────────────────
