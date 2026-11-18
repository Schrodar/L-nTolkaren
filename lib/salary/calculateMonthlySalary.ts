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

/**
 * Indata när användaren räknar för hand i stället för från AO och lönespec.
 * Utan datum går varken OB-fönstren eller vardag/helg-delaren att härleda, så
 * här anges timmarna redan uppdelade.
 */
export type ManualSalaryInput = {
  tariff: TariffTable;
  tenure: TenureKey;
  employmentType: EmploymentType;
  /** Ordinarie timmar — lönegrund vid timlön, utan effekt vid månadslön. */
  ordinaryHours: number;
  obHours: number;
  overtimeWeekdayHours: number;
  overtimeWeekendHours: number;
  engineAttendantDays: number;
  /** Timmar ur kompsaldot som tas ut i pengar i stället för ledighet (§11.3). */
  kompCashHours: number;
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
  /** Utbetald komptid (§11.3). Noll i den automatiska beräkningen. */
  kompCashPay: number;
  total: number;
  // Detaljer för visning
  obHours: number;
  overtimeWeekdayHours: number;
  overtimeWeekendHours: number;
  totalWorkedHours: number;
  engineAttendantDays: number;
  kompCashHours: number;
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

/**
 * Timsatserna som allt räknas ur. Delas av den automatiska och den manuella
 * beräkningen så att de aldrig kan glida isär.
 */
/**
 * De fasta månadstilläggen — rederi- och däckmanstillägg. Maskinskötsel
 * räknas per dag och ingår inte.
 */
export function fixedMonthlySupplements(
  activeAllowances: Set<AllowanceKey>,
  allowanceAmounts: Record<AllowanceKey, number>
): number {
  let summa = 0;
  if (activeAllowances.has('rederi')) summa += allowanceAmounts['rederi'];
  if (activeAllowances.has('dackman')) summa += allowanceAmounts['dackman'];
  return summa;
}

/**
 * Timsatserna som allt räknas ur.
 *
 * `extraMonthly` är de fasta månadstilläggen. Delarna ska tillämpas på hela
 * det fasta månadsbeloppet, inte bara tarifflönen — verifierat mot en spec
 * där månadslön 33 724 + däckman 2 721 + rederi 655 = 37 100 ger exakt de
 * satser arbetsgivaren använt: 37 100 ÷ 152 = 244,08 (art 320, komp till
 * pengar) och 37 100 ÷ 104 = 356,73 (art 301, övertid). Enbart tarifflönen
 * hade gett 221,87 respektive 324,27.
 *
 * Utelämnas argumentet räknas bara tarifflönen, vilket är vad den
 * automatiska kalenderberäkningen gör i dag.
 */
export function salaryRates(
  tariff: TariffTable,
  tenure: TenureKey,
  extraMonthly = 0
) {
  const monthlyRate = tariff.monthly[tenure] + extraMonthly;
  return {
    monthlyRate,
    obRatePerHour: monthlyRate / 300,
    otWeekdayRate: monthlyRate / 104, // §6.3 vardag inkl. fredag
    otWeekendRate: monthlyRate / 72,  // §6.3 lördag, söndag, helg
    /**
     * Komptid som tas ut kontant. Värderas i dag med samma delare som
     * övertiden, alltså det den var värd när den tjänades in.
     */
    kompWeekdayRate: monthlyRate / 104,
    kompWeekendRate: monthlyRate / 72,
    /** Sjukavdrag per frånvarotimme. */
    sickRatePerHour: monthlyRate / 173,
    /**
     * §11.3: "Vederlags- och kompensationstid, som ersätts kontant, utgår
     * för varje timme med belopp motsvarande 1/152 av månadslönen."
     *
     * Satsen gäller per timme i kompsaldot. Uppräkningen har redan skett när
     * timmarna tjänades in — §6.3 ger 1,4 h vardag och 2 h helg per
     * övertidstimme, §7.2 ger 0,5 h per OB-timme — så här multipliceras
     * ingenting mer.
     */
    kompCashRate: monthlyRate / 152,
  };
}

/**
 * Timlönen för en anställningsform. Månadsanställda har ingen — deras
 * grundlön är månadslönen rakt av.
 */
export function hourlyRate(
  tariff: TariffTable,
  tenure: TenureKey,
  employmentType: EmploymentType
): number | null {
  if (employmentType === 'hourlySeasonal') return tariff.hourlySeasonal[tenure];
  if (employmentType === 'hourlyShortTerm') return tariff.hourlyShortTerm[tenure];
  return null;
}

/** Grundlön: månadslön rakt av, annars timmar × timlön enligt §11.2. */
function calcBaseSalary(
  tariff: TariffTable,
  tenure: TenureKey,
  employmentType: EmploymentType,
  ordinaryHours: number
): number {
  if (employmentType === 'monthly') return tariff.monthly[tenure];
  const hourlyRate =
    employmentType === 'hourlySeasonal'
      ? tariff.hourlySeasonal[tenure]
      : tariff.hourlyShortTerm[tenure];
  return ordinaryHours * hourlyRate;
}

/** Tilläggen — maskinskötsel per dag, rederi och däckman per månad. */
function calcAllowances(
  engineAttendantDays: number,
  activeAllowances: Set<AllowanceKey>,
  allowanceAmounts: Record<AllowanceKey, number>
) {
  return {
    engineAttendant: engineAttendantDays * allowanceAmounts['maskinskots'],
    rederiAllowance: activeAllowances.has('rederi')
      ? allowanceAmounts['rederi']
      : 0,
    dackmanAllowance: activeAllowances.has('dackman')
      ? allowanceAmounts['dackman']
      : 0,
  };
}

/**
 * Löneberäkning från manuellt inmatade summor. Samma satser och tillägg som
 * den automatiska beräkningen — skillnaden är bara att timmarna kommer från
 * användaren i stället för från AO-schemat.
 */
export function calculateManualSalary(
  input: ManualSalaryInput
): SalaryBreakdown {
  const {
    tariff,
    tenure,
    employmentType,
    ordinaryHours,
    obHours,
    overtimeWeekdayHours,
    overtimeWeekendHours,
    engineAttendantDays,
    kompCashHours,
    activeAllowances,
    allowanceAmounts,
  } = input;

  const { obRatePerHour, otWeekdayRate, otWeekendRate, kompCashRate } =
    salaryRates(
      tariff,
      tenure,
      fixedMonthlySupplements(activeAllowances, allowanceAmounts)
    );

  const baseSalary = calcBaseSalary(
    tariff,
    tenure,
    employmentType,
    ordinaryHours
  );
  const obPay = obHours * obRatePerHour;
  const overtimeWeekday = overtimeWeekdayHours * otWeekdayRate;
  const overtimeWeekend = overtimeWeekendHours * otWeekendRate;
  const { engineAttendant, rederiAllowance, dackmanAllowance } = calcAllowances(
    engineAttendantDays,
    activeAllowances,
    allowanceAmounts
  );
  const kompCashPay = kompCashHours * kompCashRate;

  return {
    baseSalary,
    obPay,
    overtimeWeekday,
    overtimeWeekend,
    engineAttendant,
    rederiAllowance,
    dackmanAllowance,
    kompCashPay,
    total:
      baseSalary +
      obPay +
      overtimeWeekday +
      overtimeWeekend +
      engineAttendant +
      rederiAllowance +
      dackmanAllowance +
      kompCashPay,
    obHours,
    overtimeWeekdayHours,
    overtimeWeekendHours,
    totalWorkedHours: ordinaryHours,
    engineAttendantDays,
    kompCashHours,
    sjukAvdrag: 0,
    sjukHours: 0,
  };
}

export function calculateMonthlySalary(input: SalaryInput): SalaryBreakdown {
  const { tariff, tenure, employmentType, days, activeAllowances, allowanceAmounts } = input;

  const { obRatePerHour, otWeekdayRate, otWeekendRate } = salaryRates(tariff, tenure);

  // Grundlön
  const totalOrdinaryHours = days.reduce(
    (sum, d) => sum + Math.max(d.aoHours, d.manualHours),
    0
  );
  const baseSalary = calcBaseSalary(
    tariff,
    tenure,
    employmentType,
    totalOrdinaryHours
  );

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
  const { engineAttendant, rederiAllowance, dackmanAllowance } = calcAllowances(
    totalEngineAttendantDays,
    activeAllowances,
    allowanceAmounts
  );

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
    // Utbetald komptid hör till den manuella räknaren — kalendern bygger
    // på schemalagda dagar och känner inte till uttag ur kompsaldot.
    kompCashPay: 0,
    total,
    obHours,
    overtimeWeekdayHours,
    overtimeWeekendHours,
    totalWorkedHours,
    engineAttendantDays: totalEngineAttendantDays,
    kompCashHours: 0,
    sjukAvdrag: 0,
    sjukHours: 0,
  };
}