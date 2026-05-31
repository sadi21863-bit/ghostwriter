export type AccuracyDomain = 'medicine' | 'law' | 'police' | 'military';

export const ACCURACY_DOMAINS: Record<AccuracyDomain, { label: string; directive: string }> = {
  medicine: {
    label: 'Medical Accuracy',
    directive: `MEDICAL ACCURACY LAYER:
EMERGENCY MEDICINE REALITIES:
- CPR does not restart a stopped heart reliably. Success rate outside hospital: ~12%. It is bridge-to-defibrillation, not a cure.
- Defibrillators do not restart stopped hearts — they reset hearts in fibrillation (chaotic rhythm). A flatline cannot be shocked.
- Gunshot wounds do not knock people off their feet unless they fall from shock/pain.
- Stab wounds to the torso do not cause immediate death. Death takes minutes to hours from blood loss.
- Head wounds bleed profusely even when minor — do not use heavy bleeding as death indicator.
- Unconsciousness from a head blow is a serious TBI, not a narrative convenience. Recovery takes days, not minutes.
- Waking up from a coma means extensive physical rehabilitation, not normal function.
- Allergic anaphylaxis without epinephrine kills in minutes. With epi, symptoms may return.

HOSPITAL PROCEDURE:
- A trauma bay has a team of 6-8 people working simultaneously, not a lone doctor.
- "Coding" means cardiac arrest is occurring. "Crashing" means rapid deterioration.
- Surgery requires pre-op prep (minimum 15-30 min for non-emergencies).
- Post-surgery patients do not have conversations for hours — anesthesia effects persist.

NARRATIVE IMPLICATION: Characters who have been through severe trauma are impaired for weeks. Physical capability should degrade realistically after injury.`,
  },
  law: {
    label: 'Legal Accuracy',
    directive: `LEGAL ACCURACY LAYER:
ARREST PROCEDURE:
- Miranda rights are read at arrest or before custodial questioning — not always at the arrest scene.
- Anything said before Miranda in custodial interrogation can be inadmissible, not everything.
- Police can lie during interrogation. This is legal in the US.
- A lawyer can be requested at any point. Questioning must stop. It does not always stop in practice.
- Bail is set by a judge at arraignment, typically within 24-48 hours of arrest.

EVIDENCE AND TRIAL:
- Evidence chain of custody is rigorous. Breaks in chain can invalidate evidence.
- "Beyond reasonable doubt" is the criminal standard. "Preponderance of evidence" is civil.
- Cases take months to years, not weeks. The TV timeline of arrest → trial in one episode is fiction.
- Plea bargaining resolves 90%+ of US criminal cases. Trials are the exception.
- Public defenders are overwhelmed. Access to quality legal defense is class-stratified.

NARRATIVE IMPLICATION: Write the bureaucratic grind, not just the dramatic confrontation. The system grinds slow and favors those with resources.`,
  },
  police: {
    label: 'Police/Detective Accuracy',
    directive: `POLICE/DETECTIVE ACCURACY LAYER:
INVESTIGATION REALITIES:
- Most crimes are solved by witnesses, confessions, and informants — not forensic cleverness.
- DNA results take weeks, not hours. Rush processing is expensive and requires justification.
- Fingerprints at a scene are common. Matching them is only useful if the person is in the database.
- Detectives do not typically run forensics themselves — separate specialist teams do.
- Jurisdictional conflicts are real and politically significant between city/county/state/federal.
- Surveillance footage quality is usually poor. High-res HD footage of strangers is rare.

INTERROGATION:
- The Reid Technique (confrontational interrogation) is standard in US law enforcement but is widely criticized for producing false confessions.
- Interrogations can legally last many hours. Suspects can leave only if not arrested.
- Detectives build rapport before confrontation. Cold interrogation openings are TV trope.

NARRATIVE IMPLICATION: Police procedure is slower, more bureaucratic, and more dependent on luck and witnesses than television suggests. The smart detective who pieces it all together from evidence is largely fiction.`,
  },
  military: {
    label: 'Military Accuracy',
    directive: `MILITARY ACCURACY LAYER:
RANK AND COMMAND:
- Enlisted soldiers do not typically socialize as equals with officers. Class divisions are structural.
- Orders are followed because of the system, not always because they're correct.
- Chain of command is everything. Going around it has serious professional consequences.
- "Sir" is for officers. Non-commissioned officers (Sergeant, Staff Sergeant, etc.) are addressed by rank.

COMBAT REALITIES:
- Combat is confusing, loud, and physically exhausting. Clear tactical thinking under fire is trained skill, not default.
- Soldiers describe combat as 95% waiting / preparation and 5% intense action.
- Friendly fire is a persistent, underreported risk. Fog of war affects professionals.
- Post-combat adrenaline crash is physically real. Soldiers shake, vomit, freeze.
- PTSD is underdiagnosed in military culture. Toughness norms suppress help-seeking.

DEPLOYMENT LIFECYCLE:
- Pre-deployment: months of training, readiness drills, family preparation.
- Deployment: rotation lengths vary (6-15 months depending on branch/conflict).
- Post-deployment: reintegration is a structured process, not a homecoming party.

NARRATIVE IMPLICATION: Military characters carry institutional identity that shapes every interaction. The unit is the primary social world. Civilians are often genuinely alien to them.`,
  },
};

export function buildAccuracyContext(domain: AccuracyDomain): string {
  return ACCURACY_DOMAINS[domain].directive;
}

export function detectAccuracyDomains(prompt: string, genres: string[]): AccuracyDomain[] {
  const detected: AccuracyDomain[] = [];
  const text = (prompt + ' ' + genres.join(' ')).toLowerCase();

  if (/\b(hospital|doctor|nurse|surgery|cpr|wound|medic|trauma|inject|diagnos|bleed|injury|emergency room)\b/.test(text)) detected.push('medicine');
  if (/\b(arrest|lawyer|attorney|court|trial|evidence|detective|crime|suspect|warrant|bail|charges)\b/.test(text)) detected.push('law');
  if (/\b(detective|police|cop|investigation|interrogat|forensic|fingerprint|crime scene|precinct)\b/.test(text)) detected.push('police');
  if (/\b(soldier|military|army|navy|marine|sergeant|lieutenant|captain|combat|deployment|platoon|unit)\b/.test(text)) detected.push('military');

  return detected;
}
