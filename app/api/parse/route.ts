import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type TextItem = { str?: string; transform?: number[] };
type Line = { y: number; text: string };
type ArtGroup = { art: string; rows: string[] };

function itemsToLines(items: TextItem[], yTolerance = 2): Line[] {
  const pts = (items || [])
    .filter((it) => it?.str && it.str.trim())
    .map((it) => {
      const t = it.transform ?? [];
      return { str: it.str as string, x: t[4] ?? 0, y: t[5] ?? 0 };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Line[] = [];
  let cur: { y: number; items: typeof pts } | null = null;

  for (const p of pts) {
    if (!cur || Math.abs(p.y - cur.y) > yTolerance) {
      if (cur) {
        cur.items.sort((a, b) => a.x - b.x);
        lines.push({
          y: cur.y,
          text: cur.items
            .map((i) => i.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        });
      }
      cur = { y: p.y, items: [p] };
    } else {
      cur.items.push(p);
    }
  }

  if (cur) {
    cur.items.sort((a, b) => a.x - b.x);
    lines.push({
      y: cur.y,
      text: cur.items
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }

  return lines;
}

function extractArtLines(lines: Line[]) {
  return lines.filter((l) => /^\d{2,5}\s/.test(l.text)).map((l) => ({ raw: l.text }));
}

function groupByArt(lines: { raw: string }[]): ArtGroup[] {
  const map: Record<string, ArtGroup> = {};

  for (const l of lines) {
    const art = l.raw.split(/\s+/)[0];
    if (!map[art]) map[art] = { art, rows: [] };
    map[art].rows.push(l.raw);
  }

  return Object.values(map);
}

export async function POST(req: Request) {
  try {
    // ✅ Dynamisk import (så Turbopack inte försöker bundla native canvas)
    const { DOMMatrix } = await import('canvas');
    (globalThis as unknown as { DOMMatrix: typeof DOMMatrix }).DOMMatrix = DOMMatrix;

    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const buf = new Uint8Array(await file.arrayBuffer());

    type PdfJsLegacy = {
      getDocument: (src: { data: Uint8Array; disableWorker: boolean }) => {
        promise: Promise<{
          numPages: number;
          getPage: (pageNumber: number) => Promise<{
            getTextContent: () => Promise<{ items: TextItem[] }>;
          }>;
        }>;
      };
    };

    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsLegacy;
    const pdf = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;

    const allRows: { raw: string }[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const lines = itemsToLines(content.items as TextItem[], 2);
      allRows.push(...extractArtLines(lines));
    }

    const artGroups = groupByArt(allRows);

    return NextResponse.json({ artGroups });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}
