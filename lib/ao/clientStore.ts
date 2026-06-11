/**
 * Client-side lagring av parsad AO-data i localStorage.
 *
 * Sajten deployas på Netlify där API-routes kör i serverless-miljö med
 * efemärt filsystem — `storage/ao/` på servern överlever inte mellan
 * anrop/deployer. Därför sparas uppladdade AO-scheman även i användarens
 * webbläsare, och båtlistan/kalendern läser lokalt sparad data först med
 * server-API:t som fallback (lokal utveckling).
 *
 * Varje båt (slug) kan ha FLERA sparade AO-utgåvor med olika
 * giltighetsperioder (t.ex. vinter-AO + vår/höst-AO). Vid uppladdning
 * ersätts utgåvor vars perioder överlappar den nya; övriga behålls.
 * Kalendern väljer utgåvan vars validPeriods täcker den visade månaden.
 */

import type {
  AoMode,
  AoPeriod,
  ParsedAoSheet,
  StoredAoSheetMeta,
} from "@/lib/ao/types";

const STORAGE_KEY = "lonetolkaren.ao.sheets.v2";
const LEGACY_KEY_V1 = "lonetolkaren.ao.sheets.v1";

type LocalAoEntry = {
  savedAt: string;
  sheet: ParsedAoSheet;
};

/** En båt-slug → alla sparade AO-utgåvor för båten. */
type LocalAoStore = Record<string, LocalAoEntry[]>;

function readStore(): LocalAoStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalAoStore;
      return parsed && typeof parsed === "object" ? parsed : {};
    }
    // Migrera v1 (en utgåva per slug) → v2 (lista av utgåvor)
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY_V1);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, LocalAoEntry>;
      const migrated: LocalAoStore = {};
      for (const [slug, entry] of Object.entries(legacy)) {
        if (entry && entry.sheet) migrated[slug] = [entry];
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_KEY_V1);
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store: LocalAoStore): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    // t.ex. QuotaExceededError
    return false;
  }
}

/** Samma bakåtkompatibilitets-ifyllnad som server-sidans loadParsedAoSheet. */
function normalizeSheet(sheet: ParsedAoSheet): ParsedAoSheet {
  if (!sheet.validPeriods) {
    sheet.validPeriods =
      sheet.validFrom && sheet.validTo
        ? [{ from: sheet.validFrom, to: sheet.validTo }]
        : [];
  }
  if (sheet.hasIsVariant === undefined) {
    sheet.hasIsVariant = sheet.blocks?.some((b) => b.mode === "is") ?? false;
  }
  for (const block of sheet.blocks ?? []) {
    if (!block.extraPeriods) block.extraPeriods = [];
    if (block.modeExplicit === undefined) block.modeExplicit = true;
    if (block.crewIndex === undefined) block.crewIndex = 0;
  }
  return sheet;
}

function sheetPeriods(sheet: ParsedAoSheet): AoPeriod[] {
  if (Array.isArray(sheet.validPeriods) && sheet.validPeriods.length > 0) {
    return sheet.validPeriods;
  }
  return sheet.validFrom && sheet.validTo
    ? [{ from: sheet.validFrom, to: sheet.validTo }]
    : [];
}

function periodsOverlap(a: AoPeriod[], b: AoPeriod[]): boolean {
  for (const pa of a) {
    for (const pb of b) {
      if (pa.from <= pb.to && pa.to >= pb.from) return true;
    }
  }
  return false;
}

/** Bygger listnings-metadata för en båt utifrån ALLA sparade utgåvor. */
function buildBoatMeta(slug: string, entries: LocalAoEntry[]): StoredAoSheetMeta | null {
  const valid = entries.filter((e) => {
    const blocks = Array.isArray(e.sheet.blocks) ? e.sheet.blocks : [];
    return blocks.some(
      (b) =>
        Array.isArray(b.weeklySchedule) &&
        b.weeklySchedule.some((r) => r.workStart)
    );
  });
  if (valid.length === 0) return null;

  // Senast sparad utgåva ger namn m.m.
  const latest = [...valid].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];

  const allPeriods: AoPeriod[] = [];
  const modes = new Set<AoMode>();
  let blockCount = 0;
  let exceptionCount = 0;
  let hasIsVariant = false;

  for (const e of valid) {
    const sheet = normalizeSheet(e.sheet);
    allPeriods.push(...sheetPeriods(sheet));
    blockCount += sheet.blocks?.length ?? 0;
    for (const b of sheet.blocks ?? []) {
      if (b.mode === "is" || b.mode === "isfri") modes.add(b.mode);
      exceptionCount += Array.isArray(b.exceptions) ? b.exceptions.length : 0;
    }
    if (sheet.hasIsVariant) hasIsVariant = true;
  }

  allPeriods.sort((a, b) => a.from.localeCompare(b.from));

  return {
    slug,
    sheetName: latest.sheet.sheetName ?? slug,
    vesselName: latest.sheet.vesselName ?? null,
    validFrom: allPeriods[0]?.from ?? null,
    validTo: allPeriods[allPeriods.length - 1]?.to ?? null,
    blockCount,
    modes: Array.from(modes),
    exceptionCount,
    savedAt: latest.savedAt,
    hasIsVariant,
    validPeriods: allPeriods,
  };
}

// ── Publikt API ─────────────────────────────────────────────────────────────

/**
 * Sparar uppladdade blad lokalt. Utgåvor vars giltighetsperioder överlappar
 * den nya ersätts (ny utgåva av samma säsong); övriga behålls (annan säsong).
 * Returnerar false om lagringen misslyckades.
 */
export function saveLocalAoSheets(
  entries: { slug: string; sheet: ParsedAoSheet }[]
): boolean {
  const store = readStore();
  const savedAt = new Date().toISOString();
  for (const { slug, sheet } of entries) {
    if (!slug) continue;
    const newPeriods = sheetPeriods(sheet);
    const existing = store[slug] ?? [];
    const kept =
      newPeriods.length > 0
        ? existing.filter((e) => !periodsOverlap(sheetPeriods(e.sheet), newPeriods))
        : []; // utan giltighetstid kan vi inte jämföra — ersätt allt
    store[slug] = [...kept, { savedAt, sheet }];
  }
  return writeStore(store);
}

/**
 * Hämtar den AO-utgåva för båten vars giltighetsperioder täcker (överlappar)
 * den angivna månaden ("ÅÅÅÅ-MM"). Om ingen täcker månaden returneras den
 * senast sparade utgåvan, så att kalenderns täckningsvarning kan visas.
 */
export function getLocalAoSheetForMonth(
  slug: string,
  monthISO: string
): ParsedAoSheet | null {
  const entries = readStore()[slug];
  if (!entries || entries.length === 0) return null;

  const [y, m] = monthISO.split("-");
  const monthStart = `${monthISO}-01`;
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const monthEnd = `${monthISO}-${String(lastDay).padStart(2, "0")}`;
  const monthPeriod: AoPeriod[] = [{ from: monthStart, to: monthEnd }];

  const sorted = [...entries].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const covering = sorted.find((e) =>
    periodsOverlap(sheetPeriods(e.sheet), monthPeriod)
  );
  return normalizeSheet((covering ?? sorted[0]).sheet);
}

/** Listar en metadata-post per båt (alla utgåvors perioder sammanslagna). */
export function listLocalAoSheets(): StoredAoSheetMeta[] {
  const store = readStore();
  const results: StoredAoSheetMeta[] = [];
  for (const [slug, entries] of Object.entries(store)) {
    try {
      const meta = buildBoatMeta(slug, entries);
      if (meta) results.push(meta);
    } catch {
      // Hoppa över korrupta poster tyst
    }
  }
  return results;
}

/** Tar bort båtens ALLA sparade AO-utgåvor. */
export function deleteLocalAoSheet(slug: string): boolean {
  const store = readStore();
  if (!(slug in store)) return false;
  delete store[slug];
  writeStore(store);
  return true;
}

/**
 * Slår ihop server- och lokal lista (dedupe på slug, lokal vinner)
 * sorterad på båtnamn enligt svensk ordning.
 */
export function mergeAoSheetLists(
  serverSheets: StoredAoSheetMeta[],
  localSheets: StoredAoSheetMeta[]
): StoredAoSheetMeta[] {
  const bySlug = new Map<string, StoredAoSheetMeta>();
  for (const s of serverSheets) bySlug.set(s.slug, s);
  for (const s of localSheets) bySlug.set(s.slug, s);
  return Array.from(bySlug.values()).sort((a, b) =>
    (a.vesselName ?? a.sheetName).localeCompare(b.vesselName ?? b.sheetName, "sv")
  );
}
