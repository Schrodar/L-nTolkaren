/**
 * AO-Excel-parser för Lönetolkaren.
 *
 * Läser Excel-arbetsböcker (AO-scheman) och extraherar strukturerad data
 * enligt ParsedAoSheet-formatet.
 *
 * Faktisk Excel-kolumnstruktur:
 *   Col A  = tom (eller periodrubriker)
 *   Col B  = Dag (mån / tis / ... / 23.12 / etc.)
 *   Col C  = Klockslag START
 *   Col D  = "-" separator
 *   Col E  = Klockslag SLUT
 *   Col F  = Tim – AO-bruttotid
 *   Col G  = AO-rast B start
 *   Col H  = "-" separator
 *   Col I  = AO-rast B slut
 *   Col J  = Annan rast 1 start
 *   Col K  = "-" separator
 *   Col L  = Annan rast 1 slut
 *   Col M  = Annan rast 2 start
 *   Col N  = "-" separator
 *   Col O  = Annan rast 2 slut
 *   Col P  = Annan rast mat start
 *   Col Q  = "-" separator
 *   Col R  = Annan rast mat slut
 */

import * as XLSX from "xlsx";
import type {
  AoBlock,
  AoExceptionRow,
  AoMode,
  AoPeriod,
  AoWorkRow,
  ParsedAoSheet,
  WeekdayKey,
} from "@/lib/ao/types";

export type { AoBlock, AoExceptionRow, AoMode, AoWorkRow, ParsedAoSheet } from "@/lib/ao/types";

// ── Hjälpkonstanter ─────────────────────────────────────────────────────────

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

/**
 * Regex för ETT datumintervall: "2026-04-02 t.o.m. 2026-05-07"
 * Används både för att detektera blockrubriker och extrahera perioder.
 */
const PERIOD_RE =
  /(\d{4}-\d{2}-\d{2})\s+t\.?o\.?m\.?\s+(\d{4}-\d{2}-\d{2})/gi;

/**
 * Regex för undantagsetikett: "15.12", "<24.12", "1.1" osv.
 */
const DATE_LABEL_RE = /^<?(\\d{1,2})\.(\\d{1,2})/;

// ── Grundläggande cell-hjälpfunktioner ─────────────────────────────────────

function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

function parseTime(value: unknown): string | null {
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

function parseTimeRange(value: unknown): { start: string; end: string } | null {
  const s = cellStr(value);
  if (!s || s === "-") return null;

  const m = s.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;

  const start = parseTime(m[1]);
  const end = parseTime(m[2]);
  if (!start || !end) return null;

  return { start, end };
}

// ── Etikett-sökning i rad ───────────────────────────────────────────────────

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

function findExceptionLabelInRow(
  row: (string | number | null)[]
): { index: number; label: string } | null {
  for (let i = 0; i < row.length; i++) {
    const raw = cellStr(row[i]);
    if (!raw) continue;
    if (/^<?\d{1,2}\.\d{1,2}/.test(raw.trim())) {
      return { index: i, label: raw };
    }
  }
  return null;
}

// ── Tidsläsning relativt etikett-positionen ─────────────────────────────────

type TimeSlot =
  | { kind: "single"; value: string }
  | { kind: "range"; start: string; end: string }
  | { kind: "empty" };

function cellToSlot(value: unknown): TimeSlot {
  const range = parseTimeRange(value);
  if (range) return { kind: "range", start: range.start, end: range.end };
  const single = parseTime(value);
  if (single) return { kind: "single", value: single };
  return { kind: "empty" };
}

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

  let workStart: string | null = null;
  let workEnd: string | null = null;

  const klockslagSlot = cellToSlot(get(1));
  if (klockslagSlot.kind === "range") {
    workStart = klockslagSlot.start;
    workEnd = klockslagSlot.end;
  } else {
    workStart = parseTime(get(1));
    workEnd = parseTime(get(3));
  }

  const aoBruttotid = parseTime(get(4));
  const aoRastStart = parseTime(get(5));
  const aoRastEnd = parseTime(get(7));
  const annanRast1Start = parseTime(get(8));
  const annanRast1End = parseTime(get(10));
  const annanRast2Start = parseTime(get(11));
  const annanRast2End = parseTime(get(13));
  const annanRastMatStart = parseTime(get(14));
  const annanRastMatEnd = parseTime(get(16));

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

// ── Period-hjälpfunktioner ──────────────────────────────────────────────────

function normalizeWeekday(label: string): WeekdayKey | undefined {
  const clean = label.toLowerCase().replace(/[<>]/g, "").trim();
  return WEEKDAY_MAP[clean];
}

/**
 * Detekterar isläge från en blockrubrik.
 * Returnerar { mode, explicit } där explicit=false innebär att
 * rubriken inte nämner is/isfri — typiskt för sommarsäsong.
 *
 * Prioritetsordning:
 *   1. "isperiod" / "is-period" → mode=is  (slår "isfri" om båda finns)
 *   2. "isfri" ensamt → mode=isfri
 *   3. Inget → mode=isfri, explicit=false (sommarsäsong)
 *
 * Bakgrund: Nämdö-rubriker kan innehålla BÅDE "Isperiod tabell 2 ... samt isfri
 * period tabell 13" — det är ett is-block med en dellinje som kör isfri.
 * Huvudläget för blocket är "is", därför kollar vi isperiod först.
 */
function detectMode(heading: string): { mode: AoMode; explicit: boolean } {
  const lower = heading.toLowerCase();

  // Kolla "isperiod" / "is-period" FÖRE "isfri" — annars missar vi
  // rubriker som "Isperiod tabell 2 ... samt isfri period tabell 13"
  if (
    lower.includes("isperiod") ||
    lower.includes("is-period")
  ) {
    return { mode: "is", explicit: true };
  }

  // Tydlig isfri-markering (utan föregående isperiod)
  if (lower.includes("isfri")) return { mode: "isfri", explicit: true };

  // Övriga is-markeringar
  if (lower.includes("is ") || lower.includes("is-") || / is$/.test(lower)) {
    return { mode: "is", explicit: true };
  }

  // Ingen is-text — sommarsäsong, ingen islägesväljare behövs
  return { mode: "isfri", explicit: false };
}

/**
 * Extraherar ALLA datumintervall från en rad eller sträng.
 * Hanterar: "2026-04-02 t.o.m. 2026-05-07 samt 2026-09-14 t.o.m. 2026-12-11"
 * → [{ from: "2026-04-02", to: "2026-05-07" }, { from: "2026-09-14", to: "2026-12-11" }]
 */
function extractAllPeriods(text: string): AoPeriod[] {
  const periods: AoPeriod[] = [];
  // Återställ lastIndex eftersom vi använder global flag
  const re = new RegExp(PERIOD_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    periods.push({ from: match[1], to: match[2] });
  }
  return periods;
}

/**
 * Kontrollerar om en rad är en blockrubrik (innehåller minst ett datumintervall).
 */
function isBlockHeading(row: (string | number | null)[]): boolean {
  const combined = row.map((c) => cellStr(c)).join(" ");
  const re = new RegExp(PERIOD_RE.source, "i");
  return re.test(combined);
}

/**
 * Löser ett undantags datumetikett till ett ISO-datum.
 * "15.12" → "2025-12-15", med hänsyn till blockperiodens år.
 */
function resolveDateLabel(
  label: string,
  periodStart: string,
  periodEnd: string
): string | null {
  const match = label.trim().match(/^<?\s*(\d{1,2})\.(\d{1,2})/);
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
  validPeriods: AoPeriod[];
  roles: string | null;
  costCenter: string | null;
}

/**
 * Söker igenom de första raderna för att extrahera fartygsinformation.
 *
 * Hanterar vår/höst-AO där giltighetstiden spänner två rader:
 *   rad 7: "2026-04-01 t.o.m. 2026-06-14 samt"
 *   rad 8: "2026-08-19 t.o.m. 2026-12-11"
 */
function extractMeta(rows: (string | number | null)[][]): SheetMeta {
  const meta: SheetMeta = {
    vesselName: null,
    vesselPrefix: null,
    registration: null,
    validPeriods: [],
    roles: null,
    costCenter: null,
  };

  const scanRows = rows.slice(0, 40);

  // Bygg en sammanhängande textsträng av de första raderna för
  // att kunna hitta giltighetstider som löper över radgränser.
  // Vi joinar raderna med mellanslag och letar efter datumintervall.
  const fullText = scanRows
    .map((r) => r.map((c) => cellStr(c)).join(" ").trim())
    .filter(Boolean)
    .join(" ");

  for (let rowIdx = 0; rowIdx < scanRows.length; rowIdx++) {
    const row = scanRows[rowIdx];
    const combined = row.map((c) => cellStr(c)).join(" ").trim();
    if (!combined) continue;
    const lower = combined.toLowerCase();

    // Fartygsnamn
    if (!meta.vesselName) {
      const vesselMatch = combined.match(
        /\b(M\/S|M\/F|M\/V|MS)\s+([^\s,;()0-9]+(?:\s+[^\s,;()0-9]+)*)/i
      );
      if (vesselMatch) {
        meta.vesselPrefix = vesselMatch[1].toUpperCase();
        meta.vesselName = vesselMatch[2].trim().replace(/\s+\d.*$/, "").trim();
      }
    }

    // Registreringssignal
    if (!meta.registration) {
      const regMatch = combined.match(
        /(?:reg\.?b(?:et)?|registrering(?:ssignal)?)[:\s]+([A-ZÅÄÖ]{2,6})/i
      );
      if (regMatch) {
        meta.registration = regMatch[1].toUpperCase();
      }
    }

    // Befattning
    if (!meta.roles && lower.includes("befattning")) {
      const roleMatch = combined.match(/befattning\s*[:\s]+(.+)/i);
      if (roleMatch) meta.roles = roleMatch[1].trim();
    }

    // Kostnadsställe
    if (!meta.costCenter) {
      const costMatch = combined.match(/kostnadsst(?:\w+)?[:\s]+(\d+)/i);
      if (costMatch) meta.costCenter = costMatch[1];
    }

    // Giltighetstider — hanterar "Gäller"-raden + eventuell fortsättning
    // Letar i den kombinerade texten för raden och nästa rad
    if (lower.includes("gäller") || lower.includes("galler")) {
      // Slå ihop denna rad + nästa för att fånga tvåradigt "samt"-mönster
      const nextRow = scanRows[rowIdx + 1];
      const nextCombined = nextRow
        ? nextRow.map((c) => cellStr(c)).join(" ").trim()
        : "";
      const twoLines = `${combined} ${nextCombined}`;
      const periods = extractAllPeriods(twoLines);
      if (periods.length > 0) {
        meta.validPeriods = periods;
      }
    }
  }

  // Fallback: om validPeriods fortfarande är tomt, sök i hela texten
  if (meta.validPeriods.length === 0) {
    meta.validPeriods = extractAllPeriods(fullText).slice(0, 4);
  }

  return meta;
}

// ── Blockparsning ───────────────────────────────────────────────────────────

/**
 * Parsar ett AO-block (rubrik + veckodagar + undantag).
 *
 * Nytt jämfört med tidigare version:
 * - extraPeriods: samlar alla datumintervall i rubriken (vår+höst i samma block)
 * - modeExplicit: sant om rubriken nämner is/isfri
 * - crewIndex: räknas upp av anroparen för samma period
 */
function parseBlock(
  headingRow: (string | number | null)[],
  dataRows: (string | number | null)[][],
  sheetName: string,
  blockIndex: number,
  crewIndex: number
): AoBlock {
  const debug = process.env.DEBUG_AO === "1";
  const headingStr = headingRow.map((c) => cellStr(c)).join(" ").trim();

  // Extrahera ALLA perioder från rubriken
  const allPeriods = extractAllPeriods(headingStr);
  const primaryPeriod = allPeriods[0] ?? { from: "", to: "" };
  const extraPeriods = allPeriods.slice(1);

  const { mode, explicit: modeExplicit } = detectMode(headingStr);

  if (debug) {
    console.log(
      `[AO] Blad="${sheetName}" Block#${blockIndex} crew=${crewIndex}` +
        ` period=${primaryPeriod.from}–${primaryPeriod.to}` +
        (extraPeriods.length > 0
          ? ` + ${extraPeriods.map((p) => `${p.from}–${p.to}`).join(", ")}`
          : "") +
        ` mode=${mode} explicit=${modeExplicit}`
    );
  }

  const weeklySchedule: AoWorkRow[] = [];
  const exceptions: AoExceptionRow[] = [];
  const notes: string[] = [];

  // Alla perioder som blocket täcker (primär + extra)
  const allBlockPeriods = [primaryPeriod, ...extraPeriods];

  for (let ri = 0; ri < dataRows.length; ri++) {
    const row = dataRows[ri];
    const combined = row.map((c) => cellStr(c)).join(" ").trim();
    if (!combined) continue;

    // Nästa blockrubrik → avsluta
    const re = new RegExp(PERIOD_RE.source, "i");
    if (re.test(combined)) break;

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

    // Veckodagsrad
    const dayHit = findDayLabelInRow(row);
    if (dayHit) {
      const times = parseTimesFromRow(row, dayHit.index);
      weeklySchedule.push({
        normalizedDay: normalizeWeekday(dayHit.label),
        dayLabel: dayHit.label,
        rawCells: row,
        ...times,
      });
      if (debug) {
        console.log(
          `[AO]   rad ${ri}: VECKODAG label="${dayHit.label}" work=${times.workStart}–${times.workEnd}`
        );
      }
      continue;
    }

    // Undantagsrad — löser datumet mot ALLA perioders intervall
    const exHit = findExceptionLabelInRow(row);
    if (exHit) {
      const times = parseTimesFromRow(row, exHit.index);

      // Prova alla perioder tills vi hittar ett matchande datum
      let resolvedDate: string | null = null;
      for (const p of allBlockPeriods) {
        resolvedDate = resolveDateLabel(exHit.label, p.from, p.to);
        if (resolvedDate) break;
      }

      exceptions.push({
        label: exHit.label,
        resolvedDate,
        rawCells: row,
        ...times,
      });
      if (debug) {
        console.log(
          `[AO]   rad ${ri}: UNDANTAG label="${exHit.label}" resolved=${resolvedDate}`
        );
      }
      continue;
    }

    if (debug) {
      console.log(`[AO]   rad ${ri}: IGNORERAD – "${combined.slice(0, 60)}"`);
    }

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
    periodStart: primaryPeriod.from,
    periodEnd: primaryPeriod.to,
    extraPeriods,
    mode,
    modeExplicit,
    crewIndex,
    weeklySchedule,
    exceptions,
    notes,
  };
}

// ── Huvud-parsningsfunktion ─────────────────────────────────────────────────

function parseSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string
): ParsedAoSheet {
  const parseErrors: string[] = [];

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
      validPeriods: [],
      hasIsVariant: false,
      roles: null,
      costCenter: null,
      blocks: [],
      parseErrors,
    };
  }

  const meta = extractMeta(rawRows);

  // Hitta alla blockrubriker
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

  // Parsa varje block och räkna crewIndex per unik primärperiod
  const blocks: AoBlock[] = [];
  const crewCountByPeriod = new Map<string, number>();

  for (let b = 0; b < blockHeadingIndices.length; b++) {
    const headingIdx = blockHeadingIndices[b];
    const nextHeadingIdx =
      b + 1 < blockHeadingIndices.length
        ? blockHeadingIndices[b + 1]
        : rawRows.length;

    const headingRow = rawRows[headingIdx];
    const dataRows = rawRows.slice(headingIdx + 1, nextHeadingIdx);

    // Bestäm crewIndex: räkna hur många block som redan har samma primärperiod
    const headingStr = headingRow.map((c) => cellStr(c)).join(" ").trim();
    const allPeriods = extractAllPeriods(headingStr);
    const primaryKey = allPeriods[0]
      ? `${allPeriods[0].from}|${allPeriods[0].to}`
      : `block${b}`;
    const crewIndex = crewCountByPeriod.get(primaryKey) ?? 0;
    crewCountByPeriod.set(primaryKey, crewIndex + 1);

    try {
      const block = parseBlock(headingRow, dataRows, sheetName, b, crewIndex);
      blocks.push(block);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      parseErrors.push(
        `Bladet "${sheetName}", block vid rad ${headingIdx + 1}: ${message}`
      );
    }
  }

  // hasIsVariant: finns det minst ett block med explicit is/isfri-markering?
  const hasIsVariant = blocks.some((b) => b.modeExplicit);

  // validPeriods: från meta (hanterar vår/höst med två intervall)
  const validPeriods = meta.validPeriods;
  const validFrom = validPeriods[0]?.from ?? null;
  const validTo = validPeriods[validPeriods.length - 1]?.to ?? null;

  return {
    sheetName,
    vesselName: meta.vesselName,
    vesselPrefix: meta.vesselPrefix,
    registration: meta.registration,
    validFrom,
    validTo,
    validPeriods,
    hasIsVariant,
    roles: meta.roles,
    costCenter: meta.costCenter,
    blocks,
    parseErrors,
  };
}

// ── Publik API ──────────────────────────────────────────────────────────────

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

    const hasContent =
      parsed.blocks.length > 0 ||
      parsed.vesselName !== null ||
      parsed.registration !== null;

    if (hasContent) {
      results.push(parsed);
    } else {
      parsed.parseErrors.push(
        `Bladet "${sheetName}" innehåller ingen tolkbar AO-data och hoppades över.`
      );
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
