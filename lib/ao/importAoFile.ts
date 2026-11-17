/**
 * Import av AO-Excel — helt i webbläsaren.
 *
 * Tidigare POST:ades filen till /api/ao/upload, som körde parsern i en
 * serverless-funktion på Netlify. Filen passerade alltså värdens
 * infrastruktur i onödan: resultatet sparades ändå bara i localStorage,
 * eftersom serverns filsystem är efemärt. Nu tolkas filen lokalt och lämnar
 * aldrig datorn — samma princip som gäller lönespecerna.
 *
 * Valideringen och felmeddelandena är oförändrade från den gamla rutten.
 */

import { parseAoWorkbook } from "@/lib/ao/parseAoWorkbook";
import { slugForSheet } from "@/lib/ao/slug";
import type { ParsedAoSheet } from "@/lib/ao/types";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

/** Max 20 MB, samma gräns som uppladdningsrutten hade. */
const MAX_SIZE = 20 * 1024 * 1024;

export type ImportAoResult =
  | { ok: true; sheets: Array<{ slug: string; sheet: ParsedAoSheet }> }
  | { ok: false; error: string };

export async function importAoFile(file: File): Promise<ImportAoResult> {
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      ok: false,
      error: `Filen måste vara en Excel-fil (.xlsx eller .xls). Fick: "${file.name}".`,
    };
  }

  if (file.size === 0) {
    return { ok: false, error: "Filen är tom." };
  }

  if (file.size > MAX_SIZE) {
    return {
      ok: false,
      error: `Filen är för stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB tillåtet.`,
    };
  }

  let parsedSheets: ParsedAoSheet[];
  try {
    parsedSheets = await parseAoWorkbook(await file.arrayBuffer());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Filen kunde inte tolkas: ${message}` };
  }

  if (parsedSheets.length === 0) {
    return {
      ok: false,
      error:
        "Inga AO-data hittades i filen. Kontrollera att du laddar upp ratt fil och att den innehaller datumintervall pa formatet ÅÅÅÅ-MM-DD t.o.m. ÅÅÅÅ-MM-DD.",
    };
  }

  return {
    ok: true,
    sheets: parsedSheets.map((sheet) => ({
      slug: slugForSheet(sheet),
      sheet,
    })),
  };
}
