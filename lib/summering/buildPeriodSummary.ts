/**
 * Summerar alla sparade lönespecar per begränsningsperiod (1 april – 31 mars).
 *
 * Arbetad tid = nominell tid (art315) + plustid (art483). Plustid är tid över
 * årsarbetstidstaket (5 h × månadens dagar) — när taket nås klipps art315 den
 * dagen och resten bokförs som art483, och dagar helt över taket saknar
 * art315-rad. En dag räknas därför som EN dag så fort den har 315 eller 483,
 * aldrig som två.
 *
 * Långdagstillägg (art K315) räknas också in: arbetstid över 10,5 h per dygn
 * ersätts enligt §5.2 med 0,4 h utöver ordinarie arbetstid, och den tiden
 * ingår i begränsningsperiodens längd. Tillägget ger bara timmar, aldrig en
 * extra dag — det ligger alltid på en dag som redan är räknad.
 *
 * Semester (art700) räknas in i årsarbetstiden enligt §5.2: varje semesterdag
 * noteras som 5,0 tim i arbetstidsjournalen och tar en av de 218 dagarna.
 * En dag som både har semester och arbetad tid räknas som arbetsdag — aldrig
 * som båda.
 *
 * Dubbletter: summeringen bygger en tabell datum → timmar i stället för att
 * addera spec för spec. Laddas samma månad upp igen (eller finns två specar
 * som överlappar) skrivs datumet över av den senast sparade specen i stället
 * för att räknas två gånger.
 */

import type { SavedPayslip } from "@/components/AppContext";

/**
 * §5.2: "Under begränsningsperioden får arbete läggas ut med högst 1825 timmar
 * under högst 218 arbetsdagar, inklusive semesterledighet (175 tim och 35
 * semesterdagar)." Begränsningsperioden börjar 1 april.
 */
export const ARSARBETSTID_TIMMAR = 1825;
export const ARSARBETSTID_DAGAR = 218;
/** "För varje semesterdag noteras 5,0 tim i arbetstidsjournalen." */
export const SEMESTER_TIMMAR_PER_DAG = 5;
/** Gräns och faktor för långdagstillägget (§5.2). */
export const LANGDAG_GRANS_H = 10.5;
export const LANGDAG_FAKTOR = 0.4;

export type DagRad = {
  dateISO: string;
  /** Semesterdagar noteras som 5 h och konkurrerar aldrig med arbetad tid. */
  typ: "arbete" | "semester";
  /** Nominell tid, art315 */
  nominell: number;
  /** Plustid, art483 */
  plus: number;
  /** Långdagstillägg, art K315 — 0,4 h per timme över 10,5 h */
  langdag: number;
  total: number;
};

export type ManadRad = {
  monthISO: string;
  /** Arbetsdagar + semesterdagar */
  dagar: number;
  arbetsDagar: number;
  semesterDagar: number;
  nominell: number;
  plus: number;
  langdagTimmar: number;
  semesterTimmar: number;
  /** Nominell + plustid + långdagstillägg + semester */
  total: number;
  /** Filnamnen på de specar som bidragit med datum i månaden */
  kallor: string[];
};

export type PeriodSummering = {
  /** Året perioden börjar, t.ex. 2026 för 2026-04-01 – 2027-03-31 */
  startYear: number;
  /** "2026/27" */
  label: string;
  startISO: string;
  endISO: string;
  /** Arbetsdagar + semesterdagar — varje datum räknas en gång */
  dagar: number;
  /** Nominell tid + plustid + långdagstillägg + semester */
  timmar: number;
  /** Dagar med 315 eller 483 */
  arbetsDagar: number;
  /** Nominell tid + plustid + långdagstillägg */
  arbetsTimmar: number;
  nominell: number;
  plus: number;
  /** Långdagstillägg (K315) — timmar, ger aldrig en extra dag */
  langdagTimmar: number;
  /** Dagar med långdagstillägg, dvs dygn över 10,5 h */
  langdagar: number;
  semesterDagar: number;
  semesterTimmar: number;
  manader: ManadRad[];
  dagRader: DagRad[];
};

/** Begränsningsperioden ett datum tillhör — den som börjar 1 april. */
export function periodStartYear(dateISO: string): number {
  const year = Number(dateISO.slice(0, 4));
  const month = Number(dateISO.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return NaN;
  return month >= 4 ? year : year - 1;
}

export function periodLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Bygger en summering per begränsningsperiod, nyaste perioden först.
 */
export function buildPeriodSummaries(
  payslips: SavedPayslip[]
): PeriodSummering[] {
  // Äldst först — senare sparade specar skriver över samma datum.
  const ordered = [...payslips].sort((a, b) =>
    (a.savedAt ?? "").localeCompare(b.savedAt ?? "")
  );

  const byDate = new Map<string, DagRad>();
  const kallorByMonth = new Map<string, Set<string>>();
  const semesterDates = new Set<string>();

  for (const spec of ordered) {
    const nominell = spec.overview?.art315?.hoursByDateISO ?? {};
    const plus = spec.overview?.art483?.hoursByDateISO ?? {};
    const langdag = spec.overview?.artK315?.hoursByDateISO ?? {};

    const noteraKalla = (dateISO: string) => {
      const monthISO = dateISO.slice(0, 7);
      const kallor = kallorByMonth.get(monthISO) ?? new Set<string>();
      if (spec.fileName) kallor.add(spec.fileName);
      kallorByMonth.set(monthISO, kallor);
    };

    const dates = new Set([
      ...Object.keys(nominell),
      ...Object.keys(plus),
      ...Object.keys(langdag),
    ]);
    for (const dateISO of dates) {
      const n = isNumber(nominell[dateISO]) ? nominell[dateISO] : 0;
      const p = isNumber(plus[dateISO]) ? plus[dateISO] : 0;
      const l = isNumber(langdag[dateISO]) ? langdag[dateISO] : 0;
      const total = n + p + l;
      if (total <= 0) continue;

      byDate.set(dateISO, {
        dateISO,
        typ: "arbete",
        nominell: n,
        plus: p,
        langdag: l,
        total,
      });
      noteraKalla(dateISO);
    }

    for (const dateISO of spec.overview?.art700?.datesISO ?? []) {
      semesterDates.add(dateISO);
      noteraKalla(dateISO);
    }
  }

  // Semesterdagar läggs in som 5 h — men bara på datum utan arbetad tid, så
  // att en dag aldrig räknas både som arbetsdag och semesterdag.
  for (const dateISO of semesterDates) {
    if (byDate.has(dateISO)) continue;
    byDate.set(dateISO, {
      dateISO,
      typ: "semester",
      nominell: 0,
      plus: 0,
      langdag: 0,
      total: SEMESTER_TIMMAR_PER_DAG,
    });
  }

  const perioder = new Map<number, PeriodSummering>();

  const ensurePeriod = (startYear: number): PeriodSummering => {
    let period = perioder.get(startYear);
    if (!period) {
      period = {
        startYear,
        label: periodLabel(startYear),
        startISO: `${startYear}-04-01`,
        endISO: `${startYear + 1}-03-31`,
        dagar: 0,
        timmar: 0,
        arbetsDagar: 0,
        arbetsTimmar: 0,
        nominell: 0,
        plus: 0,
        langdagTimmar: 0,
        langdagar: 0,
        semesterDagar: 0,
        semesterTimmar: 0,
        manader: [],
        dagRader: [],
      };
      perioder.set(startYear, period);
    }
    return period;
  };

  for (const rad of Array.from(byDate.values()).sort((a, b) =>
    a.dateISO.localeCompare(b.dateISO)
  )) {
    const startYear = periodStartYear(rad.dateISO);
    if (!Number.isFinite(startYear)) continue;

    const period = ensurePeriod(startYear);
    period.dagRader.push(rad);
    period.dagar += 1;
    period.timmar += rad.total;

    const monthISO = rad.dateISO.slice(0, 7);
    let manad = period.manader.find((m) => m.monthISO === monthISO);
    if (!manad) {
      manad = {
        monthISO,
        dagar: 0,
        arbetsDagar: 0,
        semesterDagar: 0,
        nominell: 0,
        plus: 0,
        langdagTimmar: 0,
        semesterTimmar: 0,
        total: 0,
        kallor: Array.from(kallorByMonth.get(monthISO) ?? []),
      };
      period.manader.push(manad);
    }
    manad.dagar += 1;
    manad.total += rad.total;

    if (rad.typ === "arbete") {
      period.arbetsDagar += 1;
      period.arbetsTimmar += rad.total;
      period.nominell += rad.nominell;
      period.plus += rad.plus;
      period.langdagTimmar += rad.langdag;
      if (rad.langdag > 0) period.langdagar += 1;
      manad.arbetsDagar += 1;
      manad.nominell += rad.nominell;
      manad.plus += rad.plus;
      manad.langdagTimmar += rad.langdag;
    } else {
      period.semesterDagar += 1;
      period.semesterTimmar += rad.total;
      manad.semesterDagar += 1;
      manad.semesterTimmar += rad.total;
    }
  }

  return Array.from(perioder.values()).sort((a, b) => b.startYear - a.startYear);
}
