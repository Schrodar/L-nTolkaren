/**
 * Val av AO-utgåva per datum.
 *
 * En båt kan ha flera uppladdade AO-utgåvor samtidigt (vinter, vår/höst,
 * sommar). Varje utgåva gäller bara inom sina egna giltighetsperioder, och
 * säsongsbyten sker mitt i månader (vår/höst slutar 2026-06-14, sommar börjar
 * 2026-06-15). Kalendern väljer därför utgåva per DAG, inte per månad.
 */

import type { AoPeriod, ParsedAoSheet } from "@/lib/ao/types";

/**
 * Utgåvans giltighetsperioder.
 *
 * Faller tillbaka på validFrom/validTo och sist på unionen av blockens
 * perioder, så att utgåvor där giltighetsraden inte kunde tolkas ändå
 * kan placeras i kalendern.
 */
export function sheetPeriods(sheet: ParsedAoSheet): AoPeriod[] {
  if (Array.isArray(sheet.validPeriods) && sheet.validPeriods.length > 0) {
    return sheet.validPeriods;
  }
  if (sheet.validFrom && sheet.validTo) {
    return [{ from: sheet.validFrom, to: sheet.validTo }];
  }

  const fromBlocks: AoPeriod[] = [];
  for (const block of sheet.blocks ?? []) {
    if (block.periodStart && block.periodEnd) {
      fromBlocks.push({ from: block.periodStart, to: block.periodEnd });
    }
    for (const extra of block.extraPeriods ?? []) {
      if (extra.from && extra.to) fromBlocks.push(extra);
    }
  }
  return fromBlocks;
}

export function periodsOverlap(a: AoPeriod[], b: AoPeriod[]): boolean {
  for (const pa of a) {
    for (const pb of b) {
      if (pa.from <= pb.to && pa.to >= pb.from) return true;
    }
  }
  return false;
}

/** Perioden för en hel månad ("ÅÅÅÅ-MM"). */
export function monthPeriod(monthISO: string): AoPeriod {
  const [y, m] = monthISO.split("-");
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return {
    from: `${monthISO}-01`,
    to: `${monthISO}-${String(lastDay).padStart(2, "0")}`,
  };
}

function coversDate(sheet: ParsedAoSheet, isoDate: string): boolean {
  return sheetPeriods(sheet).some((p) => p.from <= isoDate && p.to >= isoDate);
}

/** Tidigaste periodstart för sortering; utgåvor utan perioder hamnar sist. */
function firstPeriodStart(sheet: ParsedAoSheet): string {
  const periods = sheetPeriods(sheet);
  if (periods.length === 0) return "9999-99-99";
  return periods.reduce((min, p) => (p.from < min ? p.from : min), periods[0].from);
}

/**
 * Utgåvan som gäller ett visst datum, eller null om ingen täcker det
 * (t.ex. glapp mellan två säsonger).
 *
 * Vid överlapp — ska inte uppstå eftersom uppladdning ersätter överlappande
 * utgåvor, men kan finnas i äldre lagrad data — vinner den som startar senast.
 * En utgåva helt utan giltighetsperioder används bara om ingen annan matchar.
 */
export function pickEditionForDate(
  sheets: ParsedAoSheet[],
  isoDate: string
): ParsedAoSheet | null {
  let best: ParsedAoSheet | null = null;
  let bestStart = "";

  for (const sheet of sheets) {
    if (!coversDate(sheet, isoDate)) continue;
    const start = firstPeriodStart(sheet);
    if (!best || start > bestStart) {
      best = sheet;
      bestStart = start;
    }
  }

  if (best) return best;
  return sheets.find((s) => sheetPeriods(s).length === 0) ?? null;
}

/** Utgåvor som överlappar månaden, sorterade på periodstart. */
export function editionsForMonth(
  sheets: ParsedAoSheet[],
  monthISO: string
): ParsedAoSheet[] {
  const month = [monthPeriod(monthISO)];
  return sheets
    .filter((s) => {
      const periods = sheetPeriods(s);
      // Utgåva utan giltighetstid gäller överallt (bevarar äldre beteende)
      return periods.length === 0 || periodsOverlap(periods, month);
    })
    .sort((a, b) => firstPeriodStart(a).localeCompare(firstPeriodStart(b)));
}

/**
 * Dagar i månaden där en ny utgåva börjar gälla — dvs. där dagens utgåva är
 * en annan än gårdagens. Används för "Ny AO"-noteringen i kalendern.
 */
export function editionStartsInMonth(
  sheets: ParsedAoSheet[],
  monthISO: string
): Record<string, ParsedAoSheet> {
  const starts: Record<string, ParsedAoSheet> = {};
  if (sheets.length === 0) return starts;

  const { from, to } = monthPeriod(monthISO);
  const lastDay = Number(to.slice(8, 10));

  const isoAt = (day: number) =>
    `${monthISO}-${String(day).padStart(2, "0")}`;

  // Dagen före månadens första dag
  const prevDate = new Date(`${from}T12:00:00`);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevISO = prevDate.toISOString().slice(0, 10);

  let previous = pickEditionForDate(sheets, prevISO);

  for (let day = 1; day <= lastDay; day++) {
    const iso = isoAt(day);
    const current = pickEditionForDate(sheets, iso);
    if (current && current !== previous) {
      starts[iso] = current;
    }
    previous = current;
  }

  return starts;
}

/** "2026-06-15 – 2026-08-18" för visning i noteringens tooltip. */
export function periodLabel(sheet: ParsedAoSheet): string {
  return sheetPeriods(sheet)
    .map((p) => `${p.from} – ${p.to}`)
    .join(", ");
}

/**
 * Rent båtnamn för visning — AO-filernas fartygsnamn släpar med
 * "Reg.bet: XXXX Fartygsnr:" som inte hör hemma i UI eller utskrifter.
 */
export function boatLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\s+Reg\..*$/i, "").trim() || raw;
}
