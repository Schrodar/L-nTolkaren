/**
 * Server-side lagring av parsad AO-data.
 *
 * AO-scheman sparas som JSON-filer i storage/ao/ (rotkatalogen).
 * Varje blad sparas som en separat JSON-fil med ett slug-baserat filnamn.
 *
 * Filnamnet genereras från fartygsnamnet och bladnamnet, t.ex.:
 *   "M/S Nämdö" -> "ms-namdo.json"
 *   "Waxholm II" -> "waxholm-ii.json"
 *
 * Anledning till JSON-lagring istf databas:
 *   - Projektet är lokalt och behöver ingen databas
 *   - JSON-filer är enkla att inspektera, versionera och dela
 *   - Framsidan kan läsa listnings-API utan autentisering
 *
 * Framtida användning:
 *   - loadParsedAoSheet(slug) hämtar datan för AO-rapport
 *   - getAoForDate(sheet, mode, date) slår upp rätt rad
 */

import "server-only";

import fs from "node:fs";
import path from "node:path";

import type {
  AoMode,
  ParsedAoSheet,
  StoredAoSheetMeta,
} from "@/lib/ao/types";

// ── Konfiguration ───────────────────────────────────────────────────────────

/** Absolut sökväg till lagringsmappen för AO-JSON-filer. */
function getStorageDir(): string {
  return path.join(process.cwd(), "storage", "ao");
}

/** Säkerställer att lagringsmappen finns; skapar den om den saknas. */
function ensureStorageDir(): void {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Slug-generering ─────────────────────────────────────────────────────────

/**
 * Genererar ett säkert filnamn (slug) från ett fartygsnamn eller bladnamn.
 * Exempel: "M/S Nämdö" -> "ms-namdo", "Waxholm II" -> "waxholm-ii"
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Väljer bäst lämpat slug-underlag: fartygsnamn föredraget, annars bladnamn.
 */
export function slugForSheet(sheet: ParsedAoSheet): string {
  const preferred = sheet.vesselName ?? sheet.sheetName;
  return generateSlug(preferred);
}

// ── Lagringsfunktioner ──────────────────────────────────────────────────────

/**
 * Sparar ett parserat AO-blad som JSON-fil i storage/ao/.
 * Befintliga filer med samma slug skrivs över.
 *
 * @param sheet - Parsad AO-data
 * @param slug - Valfritt: åsidosätt det automatgenererade sluget
 * @returns Det slug som användes (= filnamn utan .json)
 */
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

/**
 * Laddar ett parserat AO-blad från disk givet dess slug.
 *
 * @param slug - Sluget (filnamn utan .json)
 * @returns ParsedAoSheet eller null om filen inte finns
 */
export function loadParsedAoSheet(slug: string): ParsedAoSheet | null {
  const filePath = path.join(getStorageDir(), `${slug}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Ta bort interna metadata-fält
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _savedAt, _slug, ...sheet } = parsed;
    return sheet as ParsedAoSheet;
  } catch {
    return null;
  }
}

/**
 * Listar alla sparade AO-blad med metadata (utan att läsa in hela datan).
 * Används för att rendera listan i UI.
 *
 * @returns Array av StoredAoSheetMeta, sorterad efter fartygsnamn
 */
export function listStoredAoSheets(): StoredAoSheetMeta[] {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"));

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

      // Beräkna modes och exception-antal
      const blocks = Array.isArray(sheet.blocks) ? sheet.blocks : [];

      // Hoppa över scheman utan faktiska arbetstider
      const hasWorkData = blocks.some(
        (b) =>
          Array.isArray(b.weeklySchedule) &&
          b.weeklySchedule.some((r) => r.workStart),
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

      results.push({
        slug,
        sheetName: typeof sheet.sheetName === "string" ? sheet.sheetName : slug,
        vesselName:
          typeof sheet.vesselName === "string" ? sheet.vesselName : null,
        validFrom:
          typeof sheet.validFrom === "string" ? sheet.validFrom : null,
        validTo: typeof sheet.validTo === "string" ? sheet.validTo : null,
        blockCount: blocks.length,
        modes,
        exceptionCount,
        savedAt: sheet._savedAt ?? new Date(0).toISOString(),
      });
    } catch {
      // Hoppa över korrupta filer tyst
    }
  }

  return results.sort((a, b) =>
    (a.vesselName ?? a.sheetName).localeCompare(
      b.vesselName ?? b.sheetName,
      "sv"
    )
  );
}

/**
 * Tar bort en sparad AO-JSON-fil.
 *
 * @param slug - Sluget för filen som ska tas bort
 * @returns true om filen togs bort, false om den inte existerade
 */
export function deleteStoredAoSheet(slug: string): boolean {
  // Sanera slug mot path traversal
  const safeSlug = slug.replace(/[^a-z0-9-_]/g, "");
  if (!safeSlug) return false;

  const filePath = path.join(getStorageDir(), `${safeSlug}.json`);
  if (!fs.existsSync(filePath)) return false;

  fs.unlinkSync(filePath);
  return true;
}
