/**
 * GET  /api/ao/sheets/[slug] – hämta fullständig AO-data för ett blad
 * DELETE /api/ao/sheets/[slug] – ta bort ett sparat AO-blad
 */

import { NextRequest, NextResponse } from "next/server";

import { deleteStoredAoSheet, loadParsedAoSheet } from "@/lib/ao/storage";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-_]+$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: "Ogiltigt slug." },
      { status: 400 }
    );
  }

  const sheet = loadParsedAoSheet(slug);
  if (!sheet) {
    return NextResponse.json(
      { success: false, error: `Inget AO-schema hittades för slug "${slug}".` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, sheet });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-_]+$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: "Ogiltigt slug." },
      { status: 400 }
    );
  }

  const deleted = deleteStoredAoSheet(slug);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: `AO-schemat "${slug}" finns inte.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, deleted: slug });
}
