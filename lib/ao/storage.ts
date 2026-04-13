/**
 * Server-side lagring av parsad AO-data.
 */

import "server-only";

import fs from "node:fs";
import path from "node:path";

import type {
  AoMode,
  AoPeriod,
  ParsedAoSheet,
  StoredAoSheetMeta,
} from "@/lib/ao/types";

function getStorageDir(): string {
  return path.join(process.cwd(), "storage", "ao");
}

function ensureStorageDir(): void {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Slug-generering ─────────────────────────────────────────────────────────

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugForSheet(sheet: ParsedAoSheet): string {
  const preferred = sheet.vesselName ?? sheet.sheetName;
  return generateSlug(preferred);
}

// ── Lagringsfunktioner ──────────────────────────────────────────────────────

export function saveParsedAoSheet(
  sheet: ParsedAoSheet,
  slug?: string
): string {
  ensureStorageDir();

  const usedSlug = slug ?? slugForSheet(sheet);
  const filePath = path.join(getStorageDir(), `${usedSlug}.json`);

  const payload = {
    _savedAt: new Date().toISOString(),
    _slug: usedSlug,
    ...sheet,
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return usedSlug;
}

export function loadParsedAoSheet(slug: string): ParsedAoSheet | null {
  const filePath = path.join(getStorageDir(), `${slug}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _savedAt, _slug, ...sheet } = parsed;

    // Bakåtkompatibilitet: fyll i nya fält om de saknas i äldre JSON-filer
    const s = sheet as ParsedAoSheet;
    if (!s.validPeriods) {
      s.validPeriods =
        s.validFrom && s.validTo
          ? [{ from: s.validFrom, to: s.validTo }]
          : [];
    }
    if (s.hasIsVariant === undefined) {
      s.hasIsVariant = s.blocks?.some((b) => b.mode === "is") ?? false;
    }
    // Bakåtkompatibilitet för block-fält
    for (const block of s.blocks ?? []) {
      if (!block.extraPeriods) block.extraPeriods = [];
      if (block.modeExplicit === undefined) block.modeExplicit = true;
      if (block.crewIndex === undefined) block.crewIndex = 0;
    }

    return s;
  } catch {
    return null;
  }
}

export function listStoredAoSheets(): StoredAoSheetMeta[] {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  const results: StoredAoSheetMeta[] = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const filePath = path.join(dir, file);

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw) as Record<string, unknown>;

      const sheet = data as ParsedAoSheet & {
        _savedAt?: string;
        _slug?: string;
      };

      const blocks = Array.isArray(sheet.blocks) ? sheet.blocks : [];

      const hasWorkData = blocks.some(
        (b) =>
          Array.isArray(b.weeklySchedule) &&
          b.weeklySchedule.some((r) => r.workStart)
      );
      if (!hasWorkData) continue;

      const modes = Array.from(
        new Set(
          blocks
            .map((b: { mode?: AoMode }) => b.mode)
            .filter((m): m is AoMode => m === "is" || m === "isfri")
        )
      );

      const exceptionCount = blocks.reduce(
        (sum: number, b: { exceptions?: unknown[] }) =>
          sum + (Array.isArray(b.exceptions) ? b.exceptions.length : 0),
        0
      );

      // hasIsVariant: finns explicit is/isfri-markering i något block?
      const hasIsVariant =
        (sheet.hasIsVariant as boolean | undefined) ??
        blocks.some(
          (b: { modeExplicit?: boolean; mode?: string }) =>
            b.modeExplicit === true || b.mode === "is"
        );

      // validPeriods: från sheet eller bygg från validFrom/validTo
      const validPeriods: AoPeriod[] =
        Array.isArray(sheet.validPeriods) && sheet.validPeriods.length > 0
          ? (sheet.validPeriods as AoPeriod[])
          : sheet.validFrom && sheet.validTo
          ? [
              {
                from: sheet.validFrom as string,
                to: sheet.validTo as string,
              },
            ]
          : [];

      results.push({
        slug,
        sheetName: typeof sheet.sheetName === "string" ? sheet.sheetName : slug,
        vesselName:
          typeof sheet.vesselName === "string" ? sheet.vesselName : null,
        validFrom: typeof sheet.validFrom === "string" ? sheet.validFrom : null,
        validTo: typeof sheet.validTo === "string" ? sheet.validTo : null,
        blockCount: blocks.length,
        modes,
        exceptionCount,
        savedAt: sheet._savedAt ?? new Date(0).toISOString(),
        hasIsVariant,
        validPeriods,
      });
    } catch {
      // Hoppa över korrupta filer tyst
    }
  }

  return results.sort((a, b) =>
    (a.vesselName ?? a.sheetName).localeCompare(b.vesselName ?? b.sheetName, "sv")
  );
}

export function deleteStoredAoSheet(slug: string): boolean {
  const safeSlug = slug.replace(/[^a-z0-9-_]/g, "");
  if (!safeSlug) return false;

  const filePath = path.join(getStorageDir(), `${safeSlug}.json`);
  if (!fs.existsSync(filePath)) return false;

  fs.unlinkSync(filePath);
  return true;
}
