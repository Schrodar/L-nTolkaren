/**
 * POST /api/ao/upload
 *
 * Tar emot en uppladdad AO-Excel-fil, kör parsern och sparar resultatet
 * som JSON-filer i storage/ao/.
 *
 * Förväntar sig: multipart/form-data med fältet "file" (xlsx/xls)
 *
 * Returnerar:
 * {
 *   success: true,
 *   sheets: [{
 *     slug, sheetName, vesselName, blockCount,
 *     modeCount: { is, isfri },
 *     exceptionCount,
 *     parseErrors
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";

import { parseAoWorkbook } from "@/lib/ao/parseAoWorkbook";
import { saveParsedAoSheet, slugForSheet } from "@/lib/ao/storage";

/** Tillåtna MIME-typer och filändelser för Excel-filer. */
const ALLOWED_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel",                                            // xls
  "application/octet-stream",                                            // generisk
]);

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Begäran saknar giltig formulärdata." },
      { status: 400 }
    );
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Ingen fil hittades i begäran. Fältet ska heta 'file'." },
      { status: 400 }
    );
  }

  // Validera filtyp
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  );
  const hasValidType = ALLOWED_TYPES.has(file.type) || file.type === "";

  if (!hasValidExtension && !hasValidType) {
    return NextResponse.json(
      {
        success: false,
        error: `Ogiltig filtyp: "${file.name}". Ladda upp en Excel-fil (.xlsx eller .xls).`,
      },
      { status: 400 }
    );
  }

  if (!hasValidExtension) {
    return NextResponse.json(
      {
        success: false,
        error: `Filen måste vara en Excel-fil (.xlsx eller .xls). Fick: "${file.name}".`,
      },
      { status: 400 }
    );
  }

  // Validera filstorlek (max 20 MB)
  const MAX_SIZE = 20 * 1024 * 1024;
  if (file.size === 0) {
    return NextResponse.json(
      { success: false, error: "Filen är tom." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: `Filen är för stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB tillåtet.`,
      },
      { status: 400 }
    );
  }

  // Läs filens innehåll
  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json(
      { success: false, error: "Kunde inte läsa filens innehåll." },
      { status: 500 }
    );
  }

  // Parsa Excel-filen
  let parsedSheets;
  try {
    parsedSheets = parseAoWorkbook(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: `Filen kunde inte tolkas: ${message}`,
      },
      { status: 422 }
    );
  }

  if (parsedSheets.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Inga AO-data hittades i filen. Kontrollera att du laddar upp ratt fil och att den innehaller datumintervall pa formatet ÅÅÅÅ-MM-DD t.o.m. ÅÅÅÅ-MM-DD.",
      },
      { status: 422 }
    );
  }

  // Spara parsad data och bygg svaret
  const savedSheets: Array<{
    slug: string;
    sheetName: string;
    vesselName: string | null;
    blockCount: number;
    modeCount: { is: number; isfri: number };
    exceptionCount: number;
    parseErrors: string[];
  }> = [];

  const saveErrors: string[] = [];

  for (const sheet of parsedSheets) {
    let slug: string;
    try {
      slug = saveParsedAoSheet(sheet);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      saveErrors.push(
        `Bladet "${sheet.sheetName}" kunde inte sparas: ${message}`
      );
      slug = slugForSheet(sheet);
    }

    const isCount = sheet.blocks.filter((b) => b.mode === "is").length;
    const isfriCount = sheet.blocks.filter((b) => b.mode === "isfri").length;
    const exceptionCount = sheet.blocks.reduce(
      (sum, b) => sum + b.exceptions.length,
      0
    );

    savedSheets.push({
      slug,
      sheetName: sheet.sheetName,
      vesselName: sheet.vesselName,
      blockCount: sheet.blocks.length,
      modeCount: { is: isCount, isfri: isfriCount },
      exceptionCount,
      parseErrors: sheet.parseErrors,
    });
  }

  return NextResponse.json({
    success: true,
    fileName: file.name,
    sheets: savedSheets,
    saveErrors,
    // Fullständig parsad data för preview i UI
    parsedSheets,
  });
}
