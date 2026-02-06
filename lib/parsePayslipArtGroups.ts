export type ArtGroup = { art: string; rows: string[] };

export type TextItem = {
  str?: string;
  transform?: number[];
};

export type Line = {
  y: number;
  text: string;
};

export type PageOut = {
  page: number;
  lines: Line[];
  artGroups: ArtGroup[];
};

export type ParsePayslipArtGroupsResult = {
  artGroups: ArtGroup[];
  pages?: PageOut[];
};

let pdfjsPromise: Promise<typeof import('pdfjs-dist/build/pdf.mjs')> | null = null;

async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('parsePayslipArtGroups must run in the browser (client component).');
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjs) => {
      // Next.js: använd lokal worker bundlad via URL(), ingen CDN.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

// Grupp av text-items -> rader baserat på Y
export function itemsToLines(items: TextItem[], yTolerance: number = 2): Line[] {
  const points = (items || [])
    .filter((it) => it?.str && it.str.trim())
    .map((it) => {
      const t = it.transform ?? [];
      return {
        str: it.str as string,
        x: t[4] ?? 0,
        y: t[5] ?? 0,
      };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Line[] = [];
  let current: { y: number; items: typeof points } | null = null;

  for (const p of points) {
    if (!current || Math.abs(p.y - current.y) > yTolerance) {
      if (current) {
        current.items.sort((a, b) => a.x - b.x);
        lines.push({
          y: current.y,
          text: current.items
            .map((i) => i.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        });
      }
      current = { y: p.y, items: [p] };
    } else {
      current.items.push(p);
    }
  }

  if (current) {
    current.items.sort((a, b) => a.x - b.x);
    lines.push({
      y: current.y,
      text: current.items
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }

  return lines;
}

export function extractArtLines(lines: Line[]) {
  const out: Array<{ raw: string }> = [];
  const artLineRe = /^(\d{2,5}|K\d{4})\s/;
  const dateRangeLineRe = /^\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}\b/;

  let currentArt: string | null = null;

  for (const l of lines) {
    const text = l.text;

    const m = text.match(artLineRe);
    if (m?.[1]) {
      currentArt = m[1];
      out.push({ raw: text });
      continue;
    }

    // Some specs split ART 9190 across multiple lines, where the amount row starts with the date range.
    // We only attach date-range continuations to 9190 to avoid over-grouping unrelated lines.
    if (currentArt === '9190' && dateRangeLineRe.test(text)) {
      out.push({ raw: `${currentArt} ${text}` });
      continue;
    }
  }

  return out;
}

export function groupByArt(lines: { raw: string }[]): ArtGroup[] {
  const map: Record<string, ArtGroup> = {};

  for (const l of lines) {
    const art = l.raw.split(/\s+/)[0];
    if (!map[art]) map[art] = { art, rows: [] };
    map[art].rows.push(l.raw);
  }

  return Object.values(map);
}

export async function parsePayslipArtGroups(
  data: ArrayBuffer | Uint8Array,
  opts?: {
    yTolerance?: number;
    includePages?: boolean;
    maxPages?: number;
  }
): Promise<ParsePayslipArtGroupsResult> {
  const pdfjs = await loadPdfJs();

  const yTolerance = opts?.yTolerance ?? 2;
  const includePages = opts?.includePages ?? true;

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  const pages: PageOut[] = [];
  const merged: Record<string, ArtGroup> = {};

  const numPages = pdf.numPages;
  const limit =
    typeof opts?.maxPages === 'number' && opts.maxPages > 0
      ? Math.min(numPages, opts.maxPages)
      : numPages;

  for (let pageNum = 1; pageNum <= limit; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const lines = itemsToLines(content.items as unknown as TextItem[], yTolerance);
    const extracted = extractArtLines(lines);
    const artGroups = groupByArt(extracted);

    for (const g of artGroups) {
      if (!merged[g.art]) merged[g.art] = { art: g.art, rows: [] };
      merged[g.art].rows.push(...g.rows);
    }

    if (includePages) {
      pages.push({ page: pageNum, lines, artGroups });
    }
  }

  const artGroups = Object.values(merged);
  return includePages ? { artGroups, pages } : { artGroups };
}
