/**
 * Konverterar AO-data till ResolvedDaySchedule-formatet som används i
 * WorkCalendar och DayModal.
 *
 * Tidsberäkning: (workEnd − workStart) − alla icke-tomma raster.
 * Rasttyper: AO-rast (B), Annan rast 1, Annan rast 2, Annan rast mat.
 *
 * Framtida användning: anropas från WorkCalendar när användaren väljer
 * båt + isläge + datum i Lönetolkarens löneberäkningsvy.
 */

import { getAoForDate } from "@/lib/aoparser/aoparser";
import type { AoExceptionRow, AoMode, AoWorkRow, ParsedAoSheet } from "@/lib/ao/types";
import type { BreakSpan, ResolvedDaySchedule, Shift, WorkSpan } from "@/lib/schedule/types";

// ── Konvertering AO-rad → Shift ─────────────────────────────────────────────

/**
 * Omvandlar en AoWorkRow eller AoExceptionRow till ett Shift-objekt.
 *
 * Timmar beräknas som: (workEnd − workStart) − summa av alla icke-tomma raster.
 * Raster inkluderas som BreakSpan-array för att DayModal ska kunna visa dem.
 */
function aoRowToShift(row: AoWorkRow | AoExceptionRow): Shift {
  // Arbetstid
  const work: WorkSpan | undefined =
    row.workStart && row.workEnd
      ? { start: row.workStart, end: row.workEnd }
      : undefined;

  // Alla raster – ta bara med de som har både start och slut
  const breaks: BreakSpan[] = [];

  if (row.aoRastStart && row.aoRastEnd) {
    breaks.push({ label: "AO-rast (B)", start: row.aoRastStart, end: row.aoRastEnd });
  }
  if (row.annanRast1Start && row.annanRast1End) {
    breaks.push({ label: "Annan rast", start: row.annanRast1Start, end: row.annanRast1End });
  }
  if (row.annanRast2Start && row.annanRast2End) {
    breaks.push({ label: "Annan rast 2", start: row.annanRast2Start, end: row.annanRast2End });
  }
  if (row.annanRastMatStart && row.annanRastMatEnd) {
    breaks.push({ label: "Matrast", start: row.annanRastMatStart, end: row.annanRastMatEnd });
  }

  return { work, breaks };
}

// ── Publik funktion ─────────────────────────────────────────────────────────

/**
 * Löser AO för ett specifikt datum och returnerar ett ResolvedDaySchedule.
 *
 * Prioritetsordning:
 *   1. Undantag (datumspecifik rad i exceptions[])
 *   2. Ordinarie veckoschema (weeklySchedule, slagning på veckodagen)
 *   3. Tom dag om inget block täcker datumet
 *
 * @param sheet - Parsad AO-data för en båt/ett blad
 * @param mode  - Isläge: "is" eller "isfri"
 * @param isoDate - Datum i ISO-format, t.ex. "2026-01-15"
 */
export function resolveAoDay(
  sheet: ParsedAoSheet,
  mode: AoMode,
  isoDate: string
): ResolvedDaySchedule {
  const result = getAoForDate(sheet, mode, isoDate);

  // Inget block täcker datumet, eller ingen rad hittades
  if (!result || !result.row) {
    return {
      dateISO: isoDate,
      shifts: [],
      isStandard: true,
      notes: [],
      flags:
        result && !result.row
          ? ["ingen-ao-rad"]   // block hittades men ingen veckodagsrad
          : [],
    };
  }

  const isException = result.source === "exception";

  // For exceptions: single row. For regular: one shift per crew row (handles dual-crew days).
  let crewRows: (typeof result.row)[];
  if (result.source === "regular") {
    crewRows = result.rows.length > 0 ? result.rows : [result.row];
  } else {
    crewRows = [result.row];
  }
  const shifts = crewRows.filter(Boolean).map((r) => aoRowToShift(r!));

  return {
    dateISO: isoDate,
    shifts,
    isStandard: !isException,
    notes: result.block.notes,
    flags: isException ? ["undantag"] : [],
  };
}

/**
 * Returnerar "Tid enl. koll.avt." (blå decimal) per skiftpass.
 * Används för att visa individuella pass i kalendercellen.
 */
export function calcTidEnlPerShift(resolved: ResolvedDaySchedule): number[] {
  return resolved.shifts.flatMap((shift) => {
    const start = shift.work?.start;
    const end = shift.work?.end;
    if (!start || !end) return [];
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (startMin === null || endMin === null) return [];
    let workMin = endMin - startMin;
    if (workMin < 0) workMin += 24 * 60;
    const allBreaksMin = (shift.breaks ?? []).reduce((sum, br) => {
      if (!br.start || !br.end) return sum;
      const bStart = timeToMinutes(br.start);
      const bEnd = timeToMinutes(br.end);
      if (bStart === null || bEnd === null) return sum;
      let dur = bEnd - bStart;
      if (dur < 0) dur += 24 * 60;
      return sum + dur;
    }, 0);
    const h = Math.max(0, workMin - allBreaksMin) / 60;
    return h > 0 ? [h] : [];
  });
}

/**
 * Beräknar "Tid enl. koll.avt." (blå kolumn) för en dag:
 *   (workEnd − workStart) − summa av ALLA raster (AO-rast B + annan rast)
 *
 * Returnerar null om ingen arbetstid finns för dagen.
 */
export function calcTidEnlKollAvtHours(
  resolved: ResolvedDaySchedule,
): number | null {
  let totalMinutes = 0;

  for (const shift of resolved.shifts) {
    const start = shift.work?.start;
    const end = shift.work?.end;
    if (!start || !end) continue;

    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (startMin === null || endMin === null) continue;

    let workMin = endMin - startMin;
    if (workMin < 0) workMin += 24 * 60;

    const allBreaksMin = (shift.breaks ?? []).reduce((sum, br) => {
      if (!br.start || !br.end) return sum;
      const bStart = timeToMinutes(br.start);
      const bEnd = timeToMinutes(br.end);
      if (bStart === null || bEnd === null) return sum;
      let dur = bEnd - bStart;
      if (dur < 0) dur += 24 * 60;
      return sum + dur;
    }, 0);

    totalMinutes += Math.max(0, workMin - allBreaksMin);
  }

  return totalMinutes > 0 ? totalMinutes / 60 : null;
}

/**
 * Beräknar netto arbetstimmar för en dag enligt AO:
 *   (workEnd − workStart) − AO-rast(B) endast (lila, "A-B el.C")
 *
 * Returnerar null om ingen arbetstid finns för dagen.
 */
export function calcAoNetHours(resolved: ResolvedDaySchedule): number | null {
  let totalMinutes = 0;

  for (const shift of resolved.shifts) {
    const start = shift.work?.start;
    const end = shift.work?.end;
    if (!start || !end) continue;

    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (startMin === null || endMin === null) continue;

    // Hanterar skiftpass över midnatt
    let workMin = endMin - startMin;
    if (workMin < 0) workMin += 24 * 60;

    // AO-netto = bruttotid (workEnd-workStart) MINUS AO-rast(B) endast.
    // "Annan rast" (gul) räknas INTE av från AO-netto per AO-formeln (A-B el.C).
    const aoRastBMin = (shift.breaks ?? [])
      .filter((br) => br.label === "AO-rast (B)")
      .reduce((sum, br) => {
        if (!br.start || !br.end) return sum;
        const bStart = timeToMinutes(br.start);
        const bEnd = timeToMinutes(br.end);
        if (bStart === null || bEnd === null) return sum;
        let dur = bEnd - bStart;
        if (dur < 0) dur += 24 * 60;
        return sum + dur;
      }, 0);

    totalMinutes += Math.max(0, workMin - aoRastBMin);
  }

  return totalMinutes > 0 ? totalMinutes / 60 : null;
}

function timeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}
