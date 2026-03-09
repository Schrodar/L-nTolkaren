/**
 * GET /api/ao/sheets
 *
 * Returnerar en lista över alla sparade AO-blad i storage/ao/.
 * Används av UI för att visa "Sparade AO-scheman" och för att
 * låta användaren välja vilken AO som ska användas i Lönetolkaren.
 */

import { NextResponse } from "next/server";

import { listStoredAoSheets } from "@/lib/ao/storage";

export async function GET() {
  try {
    const sheets = listStoredAoSheets();
    return NextResponse.json({ success: true, sheets });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Kunde inte läsa lagrade AO-scheman: ${message}` },
      { status: 500 }
    );
  }
}
