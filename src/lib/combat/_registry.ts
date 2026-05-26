// src/lib/combat/_registry.ts
// Separated from index.ts to avoid circular imports with context.ts.
import { KALARI_PAYATTU }   from "./styles/indian/kalari-payattu";
import { SILAMBAM }         from "./styles/indian/silambam";
import { GATKA, KUSHTI, MARDANI_KHEL } from "./styles/indian/gatka-kushti-mardani";
import { MUSHTI_YUDDHA }    from "./styles/indian/mushti-yuddha";
import { PAIKA_AKHADA }     from "./styles/indian/paika-akhada";
import { INBUAN_WRESTLING } from "./styles/indian/inbuan-wrestling";
import { HUYEN_LALLONG }    from "./styles/indian/huyen-lallong";
import { THANG_TA }         from "./styles/indian/thang-ta";
import { BOXING, STREET_FIGHTING } from "./styles/global/boxing-street";
import { MUAY_THAI }        from "./styles/global/muay-thai";
import { KRAV_MAGA }        from "./styles/global/krav-maga";
import { JUDO }             from "./styles/global/judo";
import { BRAZILIAN_JIU_JITSU } from "./styles/global/bjj";
import { CAPOEIRA }         from "./styles/global/capoeira";
import { PANKRATION }       from "./styles/global/pankration";
import { BARTITSU }         from "./styles/global/bartitsu";
import { HEMA_LONGSWORD }   from "./styles/weapons/hema-longsword";
import { NAGINATAJUTSU }    from "./styles/weapons/naginatajutsu";
import type { CombatStyle } from "./types";

export const COMBAT_STYLES: Record<string, CombatStyle> = {
  "Kalari Payattu":      KALARI_PAYATTU,
  "Silambam":            SILAMBAM,
  "Gatka":               GATKA,
  "Kushti":              KUSHTI,
  "Mardani Khel":        MARDANI_KHEL,
  "Mushti Yuddha":       MUSHTI_YUDDHA,
  "Paika Akhada":        PAIKA_AKHADA,
  "Inbuan Wrestling":    INBUAN_WRESTLING,
  "Huyen Lallong":       HUYEN_LALLONG,
  "Thang-Ta":            THANG_TA,
  "Boxing":              BOXING,
  "Street Fighting":     STREET_FIGHTING,
  "Muay Thai":           MUAY_THAI,
  "Krav Maga":           KRAV_MAGA,
  "Judo":                JUDO,
  "Brazilian Jiu-Jitsu": BRAZILIAN_JIU_JITSU,
  "Capoeira":            CAPOEIRA,
  "Pankration":          PANKRATION,
  "Bartitsu":            BARTITSU,
  "HEMA Longsword":      HEMA_LONGSWORD,
  "Naginatajutsu":       NAGINATAJUTSU,
};
