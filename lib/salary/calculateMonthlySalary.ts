/**
 * Löneberäkning enligt Skärgårdsavtalet (Almega/Seko 2025–2027).
 *
 * OB (§ 7.1):
 *   Ersättning utgår då arbete utförs:
 *   - kl 00–06 alla dagar (natt-OB)
 *   - Storhelger (påsk, pingst, midsommar, jul, nyår):
 *       helgdagsafton kl 00–24, helgdag kl 00–24, dag efter helgdag kl 00–06
 *   - Småhelger (trettondagen, 1 maj, Kristi himmelsfärd, 6 juni, Alla helgons dag):
 *       dag före helgdag kl 00–24, helgdag kl 00–24, dag efter helgdag kl 00–06
 *
 * getEffectiveAoDayType() → dagtyp som styr OB-fönstret:
 *   'söndag' → OB hela dygnet (storhelg + fysisk söndag)
 *   'lördag' → OB hela dygnet (småhelg + fysisk lördag)
 *   'fredag' → OB hela dygnet (fredag + dag-före-storhelg)
 *   'vardag' → OB endast kl 00–06
 *
 * Övertid (§ 6.3):
 *   - Vardag (inkl. fredag): månadslön ÷ 104
 *   - Lör/sön/helg:          månadslön ÷ 72
 *
 * Timlön (§ 11.2 + Bilaga 1):
 *   - Säsong/vikarie: månadslön ÷ 152
 *   - Korttid:        månadslön ÷ 145
 */

import { getEffectiveAoDayType, getHolidayInfo } from '@/lib/ao/holidayRules';
import type { EmploymentType, AllowanceKey } from '@/components/LoneberakningContext';
import type { TariffTable, TenureKey } from '@/lib/tariffs/types';

// ── Indata ──────────────────────────────────────────────────────────────────

/** Ett pass med klockslag för exakt OB-beräkning. */
export type ShiftSpan = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM" — kan vara nästa dag om passet går över midnatt
};

export type DaySalaryInput = {
  /** ISO-datum, t.ex. "2026-04-14" */
  dateISO: string;
  /** Timmar enligt AO-schema */
  aoHours: number;
  /** Manuellt inmatad ordinarie tid */
  manualHours: number;
  /**
   * Faktiska pass med klockslag från AO.
   * Om dessa finns används de för exakt OB-beräkning (natt kl 00–06).
   * Om de saknas faller vi tillbaka på dagtypsbaserad OB.
   */
  shifts: ShiftSpan[];
  /** Övertidstimmar för dagen */
  overtimeHours: number;
  /** 1 om maskinskötstillägg gäller denna dag, annars 0 */
  engineAttendantDays: number;
};

export type SalaryInput = {
  tariff: TariffTable;
  tenure: TenureKey;
  employmentType: EmploymentType;
  days: DaySalaryInput[];
  activeAllowances: Set<AllowanceKey>;
  allowanceAmounts: Record<AllowanceKey, number>;
};

// ── Resultat ─────────────────────────────────────────────────────────────────

export type SalaryBreakdown = {
  baseSalary: number;
  obPay: number;
  overtimeWeekday: number;
  overtimeWeekend: number;
  engineAttendant: number;
  rederiAllowance: number;
  dackmanAllowance: number;
  total: number;
  // Detaljer för visning
  obHours: number;
  overtimeWeekdayHours: number;
  overtimeWeekendHours: number;
  totalWorkedHours: number;
  engineAttendantDays: number;
  sjukAvdrag: number;
  sjukHours: number;
};

// ── Tid-hjälpfunktioner ──────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Beräknar överlapp i minuter mellan ett pass och ett OB-fönster.
 * Hanterar pass som går över midnatt (shiftEnd < shiftStart).
 */
function overlapMinutes(
  shiftStart: number,
  shiftEnd: number,
  windowStart: number,
  windowEnd: number
): number {
  if (shiftEnd < shiftStart) {
    // Pass över midnatt: dela i del-till-midnatt + del-från-midnatt
    return (
      overlapMinutes(shiftStart, 1440, windowStart, windowEnd) +
      overlapMinutes(0, shiftEnd, windowStart, windowEnd)
    );
  }
  return Math.max(0, Math.min(shiftEnd, windowEnd) - Math.max(shiftStart, windowStart));
}

// ── OB-beräkning ─────────────────────────────────────────────────────────────

/**
 * OB-fönster per dagtyp i minuter från midnatt.
 *
 * Enligt §7 utgår OB för:
 *   - Alla dagar kl 00–06 (natt-OB)
 *   - Storhelger (effectiveDayType='söndag' p.g.a. holidayInfo): hela dygnet
 *   - Småhelger (effectiveDayType='lördag' p.g.a. holidayInfo): hela dygnet
 *   - Dag före storhelg (effectiveDayType='fredag' p.g.a. holidayInfo): hela dygnet
 *   - Fysisk fredag: hela dygnet (fredag-OB §7)
 *   - Fysisk lördag (ej helgdag): bara 00–06
 *   - Fysisk söndag (ej helgdag): bara 00–06
 *
 * getEffectiveAoDayType() returnerar 'söndag'/'lördag'/'fredag' BÅDE för
 * fysiska dagar OCH för helgdagar. Vi måste skilja på dessa.
 */
/**
 * OB-fönster för ett datum enligt §7:
 *
 * Storhelg (helgdagsafton + helgdag):         kl 00–24
 * Dag efter storhelg/småhelg:                  kl 00–06
 * Småhelg (dag före + helgdag):                kl 00–24
 * Alla övriga dagar (inkl. fre/lör/sön):       kl 00–06
 *
 * getEffectiveAoDayType() kodar redan dessa regler:
 *   'söndag' = storhelg eller fysisk söndag
 *   'lördag' = småhelg eller fysisk lördag
 *   'fredag' = dag-före-storhelg eller fysisk fredag
 *   'vardag' = vanlig vardag
 *
 * Men vi behöver skilja på "helgdag" (→ 00–24) och "vanlig dag" (→ 00–06).
 * Det gör vi via holidayInfo.
 */
function getObWindow(dateISO: string): { start: number; end: number } {
  const holidayInfo = getHolidayInfo(dateISO);

  // Storhelg eller småhelg → OB hela dygnet (helgdagsafton + helgdag)
  if (holidayInfo?.holidayType === 'storhelg' || holidayInfo?.holidayType === 'småhelg') {
    return { start: 0, end: 1440 };
  }

  // Dag före storhelg (holidayType === null men effectiveDayType = 'fredag' via holidayInfo)
  // = dag efter helg = kl 00–06 redan täckt av natt-OB nedan
  // Dessa dagar har holidayInfo men holidayType === null
  // Enligt avtalet: dag efter storhelg/småhelg → kl 00–06 (= samma som natt-OB)

  // Alla övriga dagar → bara natt-OB kl 00–06
  return { start: 0, end: 360 };
}

/**
 * Beräknar OB-timmar för en dag.
 *
 * Med klockslag: exakt överlapp mellan pass och OB-fönstret.
 * Utan klockslag: hela dagstimmar om fredag/lör/sön, noll annars (natt-OB okänd).
 */
function calcObHours(
  dateISO: string,
  workedHours: number,
  shifts: ShiftSpan[]
): number {
  const window = getObWindow(dateISO);

  if (shifts.length === 0) {
    // Fallback utan klockslag
    const eff = getEffectiveAoDayType(dateISO);
    return eff === 'vardag' ? 0 : workedHours;
  }

  let totalObMinutes = 0;
  for (const shift of shifts) {
    const s = toMinutes(shift.start);
    const e = toMinutes(shift.end);
    totalObMinutes += overlapMinutes(s, e, window.start, window.end);
  }
  return totalObMinutes / 60;
}

// ── Övertid ──────────────────────────────────────────────────────────────────

/**
 * Fredag är OB-dag men VARDAG i övertidshänseende (÷104).
 * Lördag och söndag (inkl. storhelg/småhelg) → ÷72.
 */
function isWeekendForOvertime(dateISO: string): boolean {
  const eff = getEffectiveAoDayType(dateISO);
  return eff === 'lördag' || eff === 'söndag';
}

// ── Huvudfunktion ────────────────────────────────────────────────────────────

export function calculateMonthlySalary(input: SalaryInput): SalaryBreakdown {
  const { tariff, tenure, employmentType, days, activeAllowances, allowanceAmounts } = input;

  const monthlyRate = tariff.monthly[tenure];
  const obRatePerHour = monthlyRate / 300;
  const otWeekdayRate = monthlyRate / 104;
  const otWeekendRate = monthlyRate / 72;

  // Grundlön
  let baseSalary: number;
  if (employmentType === 'monthly') {
    baseSalary = monthlyRate;
  } else {
    const hourlyRate =
      employmentType === 'hourlySeasonal'
        ? tariff.hourlySeasonal[tenure]
        : tariff.hourlyShortTerm[tenure];
    const totalOrdinaryHours = days.reduce(
      (sum, d) => sum + Math.max(d.aoHours, d.manualHours),
      0
    );
    baseSalary = totalOrdinaryHours * hourlyRate;
  }

  let obHours = 0;
  let overtimeWeekdayHours = 0;
  let overtimeWeekendHours = 0;
  let totalWorkedHours = 0;
  let totalEngineAttendantDays = 0;

  for (const day of days) {
    const workedHours = Math.max(day.aoHours, day.manualHours);
    totalWorkedHours += workedHours;
    totalEngineAttendantDays += day.engineAttendantDays;

    obHours += calcObHours(day.dateISO, workedHours, day.shifts);

    if (day.overtimeHours > 0) {
      if (isWeekendForOvertime(day.dateISO)) {
        overtimeWeekendHours += day.overtimeHours;
      } else {
        overtimeWeekdayHours += day.overtimeHours;
      }
    }
  }

  const obPay = obHours * obRatePerHour;
  const overtimeWeekday = overtimeWeekdayHours * otWeekdayRate;
  const overtimeWeekend = overtimeWeekendHours * otWeekendRate;

  // Dagnivån avgör vilka dagar som ger maskinskötseltillägg —
  // anroparen sätter engineAttendantDays utifrån inställningen eller
  // specens/manuellt markerade maskindagar (kan gälla utan att
  // tillägget är aktiverat i Löneinställningar).
  const engineAttendant =
    totalEngineAttendantDays * allowanceAmounts['maskinskots'];
  const rederiAllowance = activeAllowances.has('rederi')
    ? allowanceAmounts['rederi']
    : 0;
  const dackmanAllowance = activeAllowances.has('dackman')
    ? allowanceAmounts['dackman']
    : 0;

  const total =
    baseSalary +
    obPay +
    overtimeWeekday +
    overtimeWeekend +
    engineAttendant +
    rederiAllowance +
    dackmanAllowance;

  return {
    baseSalary,
    obPay,
    overtimeWeekday,
    overtimeWeekend,
    engineAttendant,
    rederiAllowance,
    dackmanAllowance,
    total,
    obHours,
    overtimeWeekdayHours,
    overtimeWeekendHours,
    totalWorkedHours,
    engineAttendantDays: totalEngineAttendantDays,
    sjukAvdrag: 0,
    sjukHours: 0,
  };
}