/**
 * Bygger underlaget till årslistan över obetalt traktamente (övernattning ombord).
 *
 * Endast dagar som användaren markerat i kalendern tas med. Tiderna hämtas från
 * AO:n för dagen; finns arbetade timmar i lönespecen och de är FLER än AO:ns
 * timmar skrivs sluttiden upp med mellanskillnaden. Har specen färre timmar
 * används AO:ns tider oförändrade.
 */

import type { SavedMonth, SavedPayslip } from "@/components/AppContext";
import { getLocalAoSheets } from "@/lib/ao/clientStore";
import { boatLabel, pickEditionForDate } from "@/lib/ao/editions";
import { resolveAoDay, calcTidEnlPerShift } from "@/lib/ao/resolveAoDay";
import type { AoMode, ParsedAoSheet } from "@/lib/ao/types";

export type TraktamenteRow = {
  dateISO: string;
  /** "mån", "tis" … för snabb avläsning i listan */
  weekday: string;
  start: string | null;
  end: string | null;
  /** Sant om sluttiden skrivits upp efter lönespecens timmar */
  endAdjusted: boolean;
  /** Sant om den uppskrivna sluttiden passerat midnatt */
  endNextDay: boolean;
  boat: string;
  natthamn: string;
};

const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];

/** Tolerans i timmar (~2 min) — samma som kalenderns passmatchning. */
const TOLERANCE_H = 0.03;

function timeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesToTime(min: number): string {
  const wrapped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Passindex som markerats som arbetade för ett datum ("2026-04-13::0"). */
function activeShiftIndexes(activeShifts: string[], dateISO: string): number[] {
  const prefix = `${dateISO}::`;
  return activeShifts
    .filter((k) => k.startsWith(prefix))
    .map((k) => Number(k.slice(prefix.length)))
    .filter((n) => Number.isInteger(n));
}

export function buildTraktamenteRows(
  year: number,
  months: SavedMonth[],
  loadPayslip: (monthISO: string) => SavedPayslip | null
): TraktamenteRow[] {
  const rows: TraktamenteRow[] = [];

  for (const month of months) {
    const marked = month.traktamenteDates ?? [];
    if (marked.length === 0) continue;

    // Utgåvor cachas per båt — en månad kan innehålla flera båtar (boatByDate)
    const sheetsByBoat = new Map<string, ParsedAoSheet[]>();
    const sheetsFor = (slug: string): ParsedAoSheet[] => {
      if (!slug) return [];
      let sheets = sheetsByBoat.get(slug);
      if (!sheets) {
        sheets = getLocalAoSheets(slug);
        sheetsByBoat.set(slug, sheets);
      }
      return sheets;
    };

    const payslip = loadPayslip(month.monthISO);
    const specHours = payslip?.overview.art315?.hoursByDateISO ?? {};
    const plusHours = payslip?.overview.art483?.hoursByDateISO ?? {};

    for (const dateISO of marked) {
      if (!dateISO.startsWith(String(year))) continue;
      // Äldre sparad data kan innehålla datum från en annan månad — ta bara
      // med dagar som hör till månaden de sparats under, annars dubbleras de.
      if (!dateISO.startsWith(month.monthISO)) continue;

      // Dagens egen båt om den satts, annars månadens
      const sheet = pickEditionForDate(
        sheetsFor(month.boatByDate?.[dateISO] || month.boatSlug),
        dateISO,
      );
      let start: string | null = null;
      let end: string | null = null;
      let endAdjusted = false;
      let endNextDay = false;

      if (sheet) {
        const mode: AoMode = sheet.hasIsVariant ? month.mode : "isfri";
        const resolved = resolveAoDay(sheet, mode, dateISO);
        const perShift = calcTidEnlPerShift(resolved);

        // Markerade pass speglar vad personen faktiskt jobbade; saknas
        // markeringar används dagens alla pass.
        const active = activeShiftIndexes(month.activeShifts ?? [], dateISO);
        const useIdx =
          active.length > 0
            ? active.filter((i) => i < resolved.shifts.length)
            : resolved.shifts.map((_, i) => i);

        let startMin: number | null = null;
        let endMin: number | null = null;
        let aoHours = 0;

        for (const i of useIdx) {
          const work = resolved.shifts[i]?.work;
          aoHours += perShift[i] ?? 0;
          if (!work?.start || !work.end) continue;
          const s = timeToMinutes(work.start);
          const e = timeToMinutes(work.end);
          if (s !== null && (startMin === null || s < startMin)) startMin = s;
          if (e !== null && (endMin === null || e > endMin)) endMin = e;
        }

        if (startMin !== null) start = minutesToTime(startMin);
        if (endMin !== null) end = minutesToTime(endMin);

        // Lönespecens timmar för dagen (ordinarie + ev. plustid)
        const spec = (specHours[dateISO] ?? 0) + (plusHours[dateISO] ?? 0);
        if (spec > 0 && aoHours > 0 && endMin !== null && spec - aoHours > TOLERANCE_H) {
          const extraMin = Math.round((spec - aoHours) * 60);
          const adjusted = endMin + extraMin;
          end = minutesToTime(adjusted);
          endAdjusted = true;
          endNextDay = adjusted >= 1440;
        }
      }

      rows.push({
        dateISO,
        weekday: WEEKDAYS[new Date(`${dateISO}T12:00:00`).getDay()],
        start,
        end,
        endAdjusted,
        endNextDay,
        boat: boatLabel(sheet?.vesselName ?? sheet?.sheetName ?? ""),
        natthamn: month.natthamnByDate?.[dateISO] ?? "",
      });
    }
  }

  return rows.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}
