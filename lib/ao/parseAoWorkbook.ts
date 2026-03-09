/**
 * AO-Excel-parser för Lönetolkaren.
 *
 * Läser Excel-arbetsböcker (AO-scheman) och extraherar strukturerad data
 * enligt ParsedAoSheet-formatet.
 *
 * Varje blad tolkas separat och returneras som ett ParsedAoSheet-objekt.
 * Parsad data sparas sedan som JSON i storage/ao/ (via lib/ao/storage.ts).
 *
 * Faktisk Excel-kolumnstruktur (baserat på riktiga AO-filer):
 *   Col A  = tom (eller periodrubriker)
 *   Col B  = Dag (mån / tis / ... / 23.12 / etc.)
 *   Col C  = Klockslag START (Excel-decimaltal, t.ex. 0.354 = 08:30)
 *   Col D  = "-" (visuell separator i kalkylbladet)
 *   Col E  = Klockslag SLUT (Excel-decimaltal)
 *   Col F  = Tim – AO-bruttotid (duration, t.ex. 0.611 = 14:40)
 *   Col G  = AO-rast B start
 *   Col H  = "-" separator
 *   Col I  = AO-rast B slut
 *   Col J  = Annan rast 1 start (gul)
 *   Col K  = "-" separator
 *   Col L  = Annan rast 1 slut (gul)
 *   Col M  = Annan rast 2 start
 *   Col N  = "-" separator
 *   Col O  = Annan rast 2 slut
 *   Col P  = Annan rast mat start
 *   Col Q  = "-" separator
 *   Col R  = Annan rast mat slut
 *   Col S+ = AO-netto, Tid enl., Per.1, Per.2, Totalt …
 *
 * VIKTIGT: Dag-etiketten söks i HELA raden (inte bara i row[0]) eftersom
 * kolumnen inte alltid är fast.  Klockslag-cellen parses som range-sträng.
 */

import * as XLSX from "xlsx";
import type {
  AoBlock,
  AoExceptionRow,
  AoMode,
  AoWorkRow,
  ParsedAoSheet,
  WeekdayKey,
} from "@/lib/ao/types";

// Re-exportera typer så att de kan importeras från denna modul
export type { AoBlock, AoExceptionRow, AoMode, AoWorkRow, ParsedAoSheet } from "@/lib/ao/types";

// ── Hjälpkonstanter ─────────────────────────────────────────────────────────

/** Svenska veckodagsetiketter → normaliserade engelska nycklar. */
const WEEKDAY_MAP: Record<string, WeekdayKey> = {
  mån: "mon",
  man: "mon",
  tis: "tue",
  ons: "wed",
  tor: "thu",
  fre: "fri",
  lör: "sat",
  lor: "sat",
  sön: "sun",
  son: "sun",
};

/** Regex för AO-datumintervall i en blockrubrik. */
const PERIOD_RE =
  /(\d{4}-\d{2}-\d{2})\s+t\.?o\.?m\.?\s+(\d{4}-\d{2}-\d{2})/i;

/**
 * Regex för undantagsetikett: "15.12", "<24.12", "1.1" osv.
 * Tillåter ett valfritt inledande "<" (skiftpassnotation).
 */
const DATE_LABEL_RE = /^<?(\d{1,2})\.(\d{1,2})/;

// ── Grundläggande cell-hjälpfunktioner ─────────────────────────────────────

/** Normaliserar en cell till sträng, trimmar whitespace. */
function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/**
 * Parsar ett enskilt tidsvärde (HH:MM) från en cell.
 * Hanterar:
 *   - Sträng "HH:MM" eller "H:MM"
 *   - Excels decimaltal för tider (0.0–1.0 = 00:00–24:00)
 * Returnerar null om värdet inte är en giltig tid.
 */
function parseTime(value: unknown): string | null {
  // Decimaltal från Excel (t.ex. 0.3125 = 07:30)
  if (typeof value === "number" && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const s = cellStr(value);
  if (!s || s === "-") return null;

  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h <= 23 && min <= 59) {
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Parsar en kombinerad "range"-cell, t.ex. "07:20 - 20:20".
 * Returnerar { start, end } eller null.
 * Används för Klockslag-kolumnen och eventuella rastceller.
 */
function parseTimeRange(
  value: unknown
): { start: string; end: string } | null {
  const s = cellStr(value);
  if (!s || s === "-") return null;

  // Mönster: "07:20 - 20:20" (med valfria mellanslag runt bindestreck)
  const m = s.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;

  const start = parseTime(m[1]);
  const end = parseTime(m[2]);
  if (!start || !end) return null;

  return { start, end };
}

// ── Etikett-sökning i rad ───────────────────────────────────────────────────

/**
 * Söker igenom HELA raden efter en veckodagsetikett (mån, tis, …, sön).
 * Hanterar prefix/suffix "<" och ">" (skiftpassnotation, t.ex. "fre>", "<lör").
 *
 * @returns { index, label } om hittad, annars null
 */
function findDayLabelInRow(
  row: (string | number | null)[]
): { index: number; label: string } | null {
  for (let i = 0; i < row.length; i++) {
    const raw = cellStr(row[i]);
    if (!raw) continue;

    const clean = raw.toLowerCase().replace(/[<>]/g, "").trim();
    if (Object.prototype.hasOwnProperty.call(WEEKDAY_MAP, clean)) {
      return { index: i, label: raw };
    }
  }
  return null;
}

/**
 * Söker igenom HELA raden efter en datumetikett för undantag.
 * Matchar: "15.12", "1.1", "<24.12", "30.12 Nyår" osv.
 *
 * @returns { index, label } om hittad, annars null
 */
function findExceptionLabelInRow(
  row: (string | number | null)[]
): { index: number; label: string } | null {
  for (let i = 0; i < row.length; i++) {
    const raw = cellStr(row[i]);
    if (!raw) continue;

    if (DATE_LABEL_RE.test(raw.trim())) {
      return { index: i, label: raw };
    }
  }
  return null;
}

// ── Tidsläsning relativt etikett-positionen ─────────────────────────────────

/**
 * Typ som representerar en "slot" i tids-sekvensen.
 * En slot är antingen ett enskilt tidsvärde, ett range-par (start+end),
 * eller null (tom cell / streck).
 */
type TimeSlot =
  | { kind: "single"; value: string }
  | { kind: "range"; start: string; end: string }
  | { kind: "empty" };

/** Parsar en cell till en TimeSlot. */
function cellToSlot(value: unknown): TimeSlot {
  // Prova range-format först ("07:20 - 20:20")
  const range = parseTimeRange(value);
  if (range) return { kind: "range", start: range.start, end: range.end };

  // Prova enskilt tidsvärde
  const single = parseTime(value);
  if (single) return { kind: "single", value: single };

  return { kind: "empty" };
}

/**
 * Läser tiderna i en AO-rad relativt etikett-positionen.
 *
 * Faktisk kolumnordning i Excel EFTER etiketten (offset från labelIndex):
 *   +1  Klockslag start (Excel-decimaltal eller enstaka "HH:MM"-sträng)
 *   +2  "-" visuell separator i kalkylbladet (alltid en streckcell)
 *   +3  Klockslag slut (workEnd)
 *   +4  Tim – AO-bruttotid (duration)
 *   +5  AO-rast B start
 *   +6  "-" separator
 *   +7  AO-rast B slut
 *   +8  Annan rast 1 start (gul)
 *   +9  "-" separator
 *   +10 Annan rast 1 slut
 *   +11 Annan rast 2 start
 *   +12 "-" separator
 *   +13 Annan rast 2 slut
 *   +14 Annan rast mat start
 *   +15 "-" separator
 *   +16 Annan rast mat slut
 *
 * Notera: "+2 = -" är alltid en streckcell som visuell separator i Excel.
 * Varje tidpar (start/slut) omges av en sådan separator.
 */
function parseTimesFromRow(
  row: (string | number | null)[],
  labelIndex: number
): {
  workStart: string | null;
  workEnd: string | null;
  aoBruttotid: string | null;
  aoRastStart: string | null;
  aoRastEnd: string | null;
  annanRast1Start: string | null;
  annanRast1End: string | null;
  annanRast2Start: string | null;
  annanRast2End: string | null;
  annanRastMatStart: string | null;
  annanRastMatEnd: string | null;
} {
  const get = (offset: number): unknown => row[labelIndex + offset] ?? null;

  // +1: Klockslag start; +2 = "-" separator; +3: Klockslag slut
  // Prova också range-sträng "HH:MM - HH:MM" i +1 för bakåtkompatibilitet
  let workStart: string | null = null;
  let workEnd: string | null = null;

  const klockslagSlot = cellToSlot(get(1));
  if (klockslagSlot.kind === "range") {
    // Äldre format: kombinerad range-sträng i en cell
    workStart = klockslagSlot.start;
    workEnd = klockslagSlot.end;
  } else {
    // Normalt format: separata celler med "-" separator emellan
    workStart = parseTime(get(1));
    workEnd = parseTime(get(3));
  }

  // +4: Tim (AO-bruttotid)
  const aoBruttotid = parseTime(get(4));

  // +5: AO-rast B start; +6 = "-"; +7: AO-rast B slut
  const aoRastStart = parseTime(get(5));
  const aoRastEnd   = parseTime(get(7));

  // +8: Annan rast 1 start; +9 = "-"; +10: Annan rast 1 slut
  const annanRast1Start = parseTime(get(8));
  const annanRast1End   = parseTime(get(10));

  // +11: Annan rast 2 start; +12 = "-"; +13: Annan rast 2 slut
  const annanRast2Start = parseTime(get(11));
  const annanRast2End   = parseTime(get(13));

  // +14: Annan rast mat start; +15 = "-"; +16: Annan rast mat slut
  const annanRastMatStart = parseTime(get(14));
  const annanRastMatEnd   = parseTime(get(16));

  return {
    workStart,
    workEnd,
    aoBruttotid,
    aoRastStart,
    aoRastEnd,
    annanRast1Start,
    annanRast1End,
    annanRast2Start,
    annanRast2End,
    annanRastMatStart,
    annanRastMatEnd,
  };
}

// ── Etikett-hjälpar-wrappers (bakåtkompatibilitet) ──────────────────────────

/** Normaliserar en veckodagsetikett till WeekdayKey. */
function normalizeWeekday(label: string): WeekdayKey | undefined {
  const clean = label.toLowerCase().replace(/[<>]/g, "").trim();
  return WEEKDAY_MAP[clean];
}

/** Identifierar isläget från en blockrubrik. */
function detectMode(heading: string): AoMode {
  const lower = heading.toLowerCase();
  if (lower.includes("isfri")) return "isfri";
  if (lower.includes("is ") || lower.includes("is-") || lower.includes("isperiod"))
    return "is";
  if (lower.includes(" is")) return "is";
  return "isfri";
}

/** Kontrollerar om en rad är en blockrubrik med datumintervall. */
function isBlockHeading(row: (string | number | null)[]): boolean {
  const combined = row.map((c) => cellStr(c)).join(" ");
  return PERIOD_RE.test(combined);
}

/** Extraherar periodstart/slut från en rad. */
function extractPeriod(
  row: (string | number | null)[]
): { from: string; to: string } | null {
  const combined = row.map((c) => cellStr(c)).join(" ");
  const match = combined.match(PERIOD_RE);
  if (!match) return null;
  return { from: match[1], to: match[2] };
}

/**
 * Löser ett undantags datumetikett till ett ISO-datum.
 * "15.12" -> "2025-12-15", med hänsyn till blockperiodens år.
 */
function resolveDateLabel(
  label: string,
  periodStart: string,
  periodEnd: string
): string | null {
  const match = label.trim().match(DATE_LABEL_RE);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const startYear = parseInt(periodStart.slice(0, 4), 10);
  const endYear = parseInt(periodEnd.slice(0, 4), 10);

  for (const year of [startYear, endYear]) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso >= periodStart && iso <= periodEnd) return iso;
  }

  return `${startYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Metadatatolkning ────────────────────────────────────────────────────────

interface SheetMeta {
  vesselName: string | null;
  vesselPrefix: string | null;
  registration: string | null;
  validFrom: string | null;
  validTo: string | null;
  roles: string | null;
  costCenter: string | null;
}

/** Söker igenom de första raderna för att extrahera fartygsinformation. */
function extractMeta(rows: (string | number | null)[][]): SheetMeta {
  const meta: SheetMeta = {
    vesselName: null,
    vesselPrefix: null,
    registration: null,
    validFrom: null,
    validTo: null,
    roles: null,
    costCenter: null,
  };

  const scanRows = rows.slice(0, 40);

  for (const row of scanRows) {
    const combined = row.map((c) => cellStr(c)).join(" ").trim();
    if (!combined) continue;
    const lower = combined.toLowerCase();

    // Fartygsnamn: "Fartyg : M/S Skarpö" eller "M/S Nämdö"
    if (!meta.vesselName) {
      const vesselMatch = combined.match(/\b(M\/S|M\/F|M\/V|MS)\s+([^\s,;()0-9]+(?:\s+[^\s,;()0-9]+)*)/i);
      if (vesselMatch) {
        meta.vesselPrefix = vesselMatch[1].toUpperCase();
        // Trimma bort trailings (t.ex. siffror eller interpunktion)
        meta.vesselName = vesselMatch[2].trim().replace(/\s+\d.*$/, "").trim();
      }
    }

    // Registreringssignal: "Reg.bet: SLZE" eller "Registrering: SMRN"
    if (!meta.registration) {
      const regMatch = combined.match(
        /(?:reg\.?b(?:et)?|registrering(?:ssignal)?)[:\s]+([A-ZÅÄÖ]{2,6})/i
      );
      if (regMatch) {
        meta.registration = regMatch[1].toUpperCase();
      }
    }

    // Giltighetstid: "2025-12-13 t.o.m. 2026-03-31" eller "Gäller : 2025-12-13 t.o.m. 2026-03-31"
    if (!meta.validFrom) {
      const validMatch = combined.match(
        /(\d{4}-\d{2}-\d{2})\s+t\.?o\.?m\.?\s+(\d{4}-\d{2}-\d{2})/
      );
      if (validMatch) {
        meta.validFrom = validMatch[1];
        meta.validTo = validMatch[2];
      }
    }

    // Befattning: "Befattning: Matros, lättmatros, jungman"
    if (!meta.roles && lower.includes("befattning")) {
      const roleMatch = combined.match(/befattning\s*[:\s]+(.+)/i);
      if (roleMatch) meta.roles = roleMatch[1].trim();
    }

    // Kostnadsställe: "Kostnadsställe: 5902" eller "Kostandsst: 5902"
    if (!meta.costCenter) {
      const costMatch = combined.match(/kostnadsst(?:\w+)?[:\s]+(\d+)/i);
      if (costMatch) meta.costCenter = costMatch[1];
    }
  }

  return meta;
}

// ── Blockparsning ───────────────────────────────────────────────────────────

/**
 * Parsar ett AO-block (rubrik + veckodagar + undantag).
 *
 * Logik:
 * 1. Sök varje rad med findDayLabelInRow() → veckodag
 * 2. Sök varje rad med findExceptionLabelInRow() → undantag
 * 3. Läs tider relativt etikett-kolumnens position i raden
 * 4. Ignorera header-rader, summerings-rader och anteckningar
 *
 * Debug: sätt DEBUG_AO=1 som env-variabel för verbose server-loggning.
 */
function parseBlock(
  headingRow: (string | number | null)[],
  dataRows: (string | number | null)[][],
  sheetName: string,
  blockIndex: number
): AoBlock {
  const debug = process.env.DEBUG_AO === "1";
  const headingStr = headingRow.map((c) => cellStr(c)).join(" ").trim();
  const period = extractPeriod(headingRow) ?? { from: "", to: "" };
  const mode = detectMode(headingStr);

  if (debug) {
    console.log(
      `[AO] Blad="${sheetName}" Block#${blockIndex} period=${period.from}–${period.to} mode=${mode}`
    );
  }

  const weeklySchedule: AoWorkRow[] = [];
  const exceptions: AoExceptionRow[] = [];
  const notes: string[] = [];

  for (let ri = 0; ri < dataRows.length; ri++) {
    const row = dataRows[ri];
    const combined = row.map((c) => cellStr(c)).join(" ").trim();
    if (!combined) continue;

    // Nästa blockrubrik → avsluta
    if (PERIOD_RE.test(combined)) break;

    const lower = combined.toLowerCase();

    // Hoppa över kolumnrubriker
    if (
      lower.includes("klockslag") ||
      lower.includes("bruttotid") ||
      (lower.includes("dag") && lower.includes("tim"))
    ) {
      if (debug) console.log(`[AO]   rad ${ri}: RUBRIK – hoppas över`);
      continue;
    }

    // ── Veckodagsrad ───────────────────────────────────────────────────────
    const dayHit = findDayLabelInRow(row);
    if (dayHit) {
      const times = parseTimesFromRow(row, dayHit.index);
      const entry: AoWorkRow = {
        normalizedDay: normalizeWeekday(dayHit.label),
        dayLabel: dayHit.label,
        rawCells: row,
        ...times,
      };
      weeklySchedule.push(entry);

      if (debug) {
        console.log(
          `[AO]   rad ${ri}: VECKODAG label="${dayHit.label}" col=${dayHit.index}` +
            ` work=${times.workStart}–${times.workEnd} brutto=${times.aoBruttotid}`
        );
      }
      continue;
    }

    // ── Undantagsrad ───────────────────────────────────────────────────────
    const exHit = findExceptionLabelInRow(row);
    if (exHit) {
      const times = parseTimesFromRow(row, exHit.index);
      const entry: AoExceptionRow = {
        label: exHit.label,
        resolvedDate: resolveDateLabel(exHit.label, period.from, period.to),
        rawCells: row,
        ...times,
      };
      exceptions.push(entry);

      if (debug) {
        console.log(
          `[AO]   rad ${ri}: UNDANTAG label="${exHit.label}" col=${exHit.index}` +
            ` resolved=${entry.resolvedDate} work=${times.workStart}–${times.workEnd}`
        );
      }
      continue;
    }

    // ── Ignorerad rad ──────────────────────────────────────────────────────
    if (debug) {
      console.log(`[AO]   rad ${ri}: IGNORERAD – "${combined.slice(0, 60)}"`);
    }

    // Samla eventuella anteckningar (korta rader efter schemat)
    if (combined.length < 160 && weeklySchedule.length > 0) {
      notes.push(combined);
    }
  }

  if (debug) {
    console.log(
      `[AO]   Block#${blockIndex} summary: ${weeklySchedule.length} veckodagar, ${exceptions.length} undantag`
    );
  }

  return {
    heading: headingStr,
    periodStart: period.from,
    periodEnd: period.to,
    mode,
    weeklySchedule,
    exceptions,
    notes,
  };
}

// ── Hoved-parsningsfunktion ─────────────────────────────────────────────────

/**
 * Parsar ett enskilt Excel-blad till en ParsedAoSheet.
 *
 * @param worksheet - XLSX-bladobjektet
 * @param sheetName - Bladets namn
 * @returns ParsedAoSheet med all tolkad data
 */
function parseSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string
): ParsedAoSheet {
  const parseErrors: string[] = [];

  // Konvertera till 2D array; header: 1 ger rå cell-arrayer
  const rawRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(
    worksheet,
    { header: 1, defval: null, raw: true }
  ) as (string | number | null)[][];

  if (!rawRows || rawRows.length === 0) {
    parseErrors.push(`Bladet "${sheetName}" är tomt.`);
    return {
      sheetName,
      vesselName: null,
      vesselPrefix: null,
      registration: null,
      validFrom: null,
      validTo: null,
      roles: null,
      costCenter: null,
      blocks: [],
      parseErrors,
    };
  }

  // Extrahera metadata
  const meta = extractMeta(rawRows);

  // Hitta alla blockrubriker och deras radindex
  const blockHeadingIndices: number[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    if (isBlockHeading(rawRows[i])) {
      blockHeadingIndices.push(i);
    }
  }

  if (blockHeadingIndices.length === 0) {
    parseErrors.push(
      `Bladet "${sheetName}": Inga AO-perioder hittades. Kontrollera att filen innehåller datumintervall på formatet "ÅÅÅÅ-MM-DD t.o.m. ÅÅÅÅ-MM-DD".`
    );
  }

  // Parsa varje block
  const blocks: AoBlock[] = [];
  for (let b = 0; b < blockHeadingIndices.length; b++) {
    const headingIdx = blockHeadingIndices[b];
    const nextHeadingIdx =
      b + 1 < blockHeadingIndices.length
        ? blockHeadingIndices[b + 1]
        : rawRows.length;

    const headingRow = rawRows[headingIdx];
    const dataRows = rawRows.slice(headingIdx + 1, nextHeadingIdx);

    try {
      const block = parseBlock(headingRow, dataRows, sheetName, b);
      blocks.push(block);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      parseErrors.push(
        `Bladet "${sheetName}", block vid rad ${headingIdx + 1}: ${message}`
      );
    }
  }

  return {
    sheetName,
    vesselName: meta.vesselName,
    vesselPrefix: meta.vesselPrefix,
    registration: meta.registration,
    validFrom: meta.validFrom,
    validTo: meta.validTo,
    roles: meta.roles,
    costCenter: meta.costCenter,
    blocks,
    parseErrors,
  };
}

// ── Publik API ──────────────────────────────────────────────────────────────

/**
 * Parsar en AO-Excel-arbetsbok och returnerar alla tolkade blad.
 *
 * Anropas från server-side (API-rutten) med raw Excel-data som Buffer.
 * Returnerar ett array där varje element representerar ett bladet.
 *
 * Tomma blad och systemblad (t.ex. "Sheet1", "Ark1") inkluderas men
 * markeras med parseErrors om de inte innehåller giltig AO-data.
 *
 * @param buffer - Excel-filens innehåll som Buffer
 * @returns Array av ParsedAoSheet, ett per blad
 */
export function parseAoWorkbook(buffer: Buffer): ParsedAoSheet[] {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Filen kan inte läsas som Excel: ${message}`);
  }

  const results: ParsedAoSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const parsed = parseSheet(worksheet, sheetName);

    // Inkludera blad som har blocks eller metadata
    const hasContent =
      parsed.blocks.length > 0 ||
      parsed.vesselName !== null ||
      parsed.registration !== null;

    if (hasContent) {
      results.push(parsed);
    } else {
      // Lägg ändå till med felmarkering för transparens
      parsed.parseErrors.push(
        `Bladet "${sheetName}" innehåller ingen tolkbar AO-data och hoppades över.`
      );
      // Inkludera bara om det finns innehåll som inte är tomt
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      }) as unknown[][];
      const nonEmptyRows = rawRows.filter((r) =>
        r.some((c) => c !== null && c !== "")
      );
      if (nonEmptyRows.length > 2) {
        results.push(parsed);
      }
    }
  }

  return results;
}
