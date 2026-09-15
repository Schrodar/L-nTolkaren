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

/**
 * En anställning på specen. Samma person kan ha flera samtidigt (t.ex. en
 * timanställning och en månadsanställning) och får då en egen art-tabell,
 * bruttolön och skatt per anställning.
 */
export type PayslipSection = {
  /** Anställningsnummer från raden "Anställning: 21107", null om specen saknar rubriken */
  anstallning: string | null;
  kostnadsstalle: string | null;
  artGroups: ArtGroup[];
};

/**
 * Specens egna slutsiffror — facit att stämma av den framräknade lönen mot.
 *
 * Bara "Att utbetala" tas med. Sammanställningsrutorna längst upp
 * ("Bruttolön perioden", "Preliminär skatt perioden") ligger i kolumner som
 * hamnar huller om buller när PDF:en läses av — på Johans spec plockas
 * skattetabellens 11 435,00 upp som preliminärskatt — och de är dessutom
 * avrundade till hela kronor. De skulle bara ge falsklarm.
 */
export type SpecTotals = {
  attUtbetala?: number;
  utbetalningsdag?: string;
};

export type ParsePayslipArtGroupsResult = {
  artGroups: ArtGroup[];
  sections: PayslipSection[];
  totals: SpecTotals;
  pages?: PageOut[];
};

let pdfjsPromise: Promise<typeof import('pdfjs-dist/build/pdf.mjs')> | null =
  null;

async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error(
      'parsePayslipArtGroups must run in the browser (client component).',
    );
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjs) => {
      // Använd statisk worker från public/ för korrekt MIME-typ i alla webbläsare
      // (Chrome kräver text/javascript – new URL(..., import.meta.url) fungerar inte alltid).
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

// Grupp av text-items -> rader baserat på Y
export function itemsToLines(
  items: TextItem[],
  yTolerance: number = 2,
): Line[] {
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

export function extractEmployeeName(lines: Line[]): string | null {
  for (const line of lines) {
    if (!line.text.includes('Blidösundsbolaget AB')) continue;

    const name = line.text.replace('Blidösundsbolaget AB', '').trim();
    if (name.length >= 2) {
      console.log('extractEmployeeName result:', name);
      return name;
    }
  }

  console.log('extractEmployeeName result:', null);
  return null;
}

/** Rubrikraden som inleder varje art-tabell: "Art Beskrivning Datum Antal ...". */
const TABLE_HEADER_RE = /^Art\b.*\bBeskrivning\b/i;
/** Rader som avslutar en art-tabell. */
const SECTION_BREAK_RE =
  /^(Anställning\s*:|Gemensamma uppgifter\b|I de fall där\b)/i;
/**
 * "Anställning: 21107 Kostnadsställe: 5800".
 *
 * Kolonet står som ett eget textobjekt i PDF:en, så pdf.js levererar raden
 * som "Anställning : 21107 Kostnadsställe : 5800" med mellanslag före
 * kolonet. Därför är blanksteget valfritt på båda sidor.
 */
const EMPLOYMENT_RE =
  /^Anställning\s*:\s*(\d+)(?:\s+Kostnadsställe\s*:\s*(\d+))?/i;

type ScannadArtRad = {
  raw: string;
  anstallning: string | null;
  kostnadsstalle: string | null;
};

/**
 * Plockar ut art-raderna ur specen tillsammans med vilken anställning de hör
 * till.
 *
 * Art-raderna står i tabeller som inleds av rubrikraden "Art Beskrivning
 * Datum ...". Utanför tabellerna finns adress- och sammanställningsrader som
 * annars tolkas som arter — företagets postnummer blev en egen "art 11149"
 * och den anställdes postort en "art 135". Därför läser vi bara innanför
 * tabellerna.
 *
 * Saknar specen rubrikraden helt läser vi alla rader som förut. Hellre några
 * skräpgrupper än att tyst tappa varenda art-rad i en spec-variant vi inte
 * sett.
 */
function scanArtRows(lines: Line[]): ScannadArtRad[] {
  const out: ScannadArtRad[] = [];
  // Some PDFs glue the art code to the description (e.g. "81001Vård...").
  // Match art code when it is followed by whitespace OR a letter, but not when
  // followed by '-' (to avoid matching date lines like "2026-02-20").
  const artLineRe = /^(\d{2,5}|K\d{3,5})(?=\s|[A-Za-zÅÄÖåäö])/;
  const dateRangeLineRe = /^\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}\b/;
  const artWithDateRangeContinuations = new Set(['9190', '534', '81001']);

  const harTabellhuvud = lines.some((l) => TABLE_HEADER_RE.test(l.text));
  let iTabell = !harTabellhuvud;

  let currentArt: string | null = null;
  let anstallning: string | null = null;
  let kostnadsstalle: string | null = null;

  for (const l of lines) {
    const text = l.text;

    const anst = text.match(EMPLOYMENT_RE);
    if (anst) {
      anstallning = anst[1] ?? null;
      kostnadsstalle = anst[2] ?? null;
    }

    if (harTabellhuvud) {
      if (TABLE_HEADER_RE.test(text)) {
        iTabell = true;
        currentArt = null;
        continue;
      }
      if (SECTION_BREAK_RE.test(text)) {
        iTabell = false;
        currentArt = null;
        // "Gemensamma uppgifter" är personens gemensamma rader (t.ex.
        // skatt på personnivå) och hör inte till någon enskild anställning.
        if (/^Gemensamma uppgifter/i.test(text)) {
          anstallning = null;
          kostnadsstalle = null;
        }
        continue;
      }
      if (!iTabell) continue;
    }

    const m = text.match(artLineRe);
    if (m?.[1]) {
      currentArt = m[1];
      const rest = text.slice(currentArt.length);
      const normalized = /^\s/.test(rest)
        ? text
        : `${currentArt} ${rest.trimStart()}`;
      out.push({ raw: normalized, anstallning, kostnadsstalle });
      continue;
    }

    // Some specs split certain ART rows across multiple lines, where the amount row starts with the date range.
    // We only attach date-range continuations for known arts to avoid over-grouping unrelated lines.
    if (
      currentArt &&
      artWithDateRangeContinuations.has(currentArt) &&
      dateRangeLineRe.test(text)
    ) {
      out.push({ raw: `${currentArt} ${text}`, anstallning, kostnadsstalle });
      continue;
    }
  }

  return out;
}

export function extractArtLines(lines: Line[]) {
  return scanArtRows(lines).map(({ raw }) => ({ raw }));
}

/** Art-raderna grupperade per anställning, i den ordning de står på specen. */
export function extractSections(lines: Line[]): PayslipSection[] {
  const sections: PayslipSection[] = [];

  for (const rad of scanArtRows(lines)) {
    let section = sections.find((s) => s.anstallning === rad.anstallning);
    if (!section) {
      section = {
        anstallning: rad.anstallning,
        kostnadsstalle: rad.kostnadsstalle,
        artGroups: [],
      };
      sections.push(section);
    }
    const art = rad.raw.match(/^(\d{2,5}|K\d{3,5})/)?.[1] ?? rad.raw.split(/\s+/)[0];
    let group = section.artGroups.find((g) => g.art === art);
    if (!group) {
      group = { art, rows: [] };
      section.artGroups.push(group);
    }
    group.rows.push(rad.raw);
  }

  return sections;
}

/** Svenskt tal med decimalkomma. Datum plockas bort först — "2026-08-25 37 447,54" skulle annars läsas som 2 537 447,54. */
function belopplistaUrText(text: string): number[] {
  const utanDatum = text.replace(/\d{4}-\d{2}-\d{2}/g, ' ');
  // Tusenavskiljaren är blanksteg, men bara i grupper om exakt tre siffror.
  const matches = utanDatum.match(/[-+]?\d+(?: \d{3})*,\d{1,2}/g) || [];
  const out: number[] = [];
  for (const m of matches) {
    const n = Number(m.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Hittar beloppet som hör till en etikett. Står det på samma rad tas det
 * därifrån, annars letar vi några rader framåt — specens kolumner hamnar
 * ibland på egna rader när PDF:en läses av.
 */
function beloppEfterEtikett(
  lines: Line[],
  etikett: RegExp,
  maxSteg = 3,
): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!etikett.test(lines[i].text)) continue;

    const egna = belopplistaUrText(lines[i].text.replace(etikett, ' '));
    if (egna.length) return egna[egna.length - 1];

    for (let j = i + 1; j <= Math.min(i + maxSteg, lines.length - 1); j++) {
      const nasta = belopplistaUrText(lines[j].text);
      if (nasta.length) return nasta[nasta.length - 1];
    }
  }
  return undefined;
}

/** Specens egna slutsiffror — facit att stämma av den framräknade lönen mot. */
export function extractSpecTotals(lines: Line[]): SpecTotals {
  const totals: SpecTotals = {};

  const netto = beloppEfterEtikett(lines, /Att\s+utbetala/i);
  if (typeof netto === 'number') totals.attUtbetala = netto;

  for (const l of lines) {
    if (!/Utbetalningsdag/i.test(l.text)) continue;
    const egen = l.text.match(/\d{4}-\d{2}-\d{2}/);
    if (egen) {
      totals.utbetalningsdag = egen[0];
      break;
    }
    const idx = lines.indexOf(l);
    for (let j = idx + 1; j <= Math.min(idx + 3, lines.length - 1); j++) {
      const d = lines[j].text.match(/\d{4}-\d{2}-\d{2}/);
      if (d) {
        totals.utbetalningsdag = d[0];
        break;
      }
    }
    break;
  }

  return totals;
}

export function groupByArt(lines: { raw: string }[]): ArtGroup[] {
  const map: Record<string, ArtGroup> = {};

  for (const l of lines) {
    const m = l.raw.match(/^(\d{2,5}|K\d{3,5})/);
    const art = m?.[1] ?? l.raw.split(/\s+/)[0];
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
  },
): Promise<ParsePayslipArtGroupsResult> {
  const pdfjs = await loadPdfJs();

  const yTolerance = opts?.yTolerance ?? 2;
  const includePages = opts?.includePages ?? true;

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  const pages: PageOut[] = [];
  // Art-tabellerna löper över sidbrytningar — Johans spec fortsätter rakt in
  // på sida 2 utan ny rubrikrad, och Joannas första anställning får sin
  // bruttolönsrad högst upp på sida 2. Raderna läses därför som en enda
  // följd i stället för sida för sida.
  const allaRader: Line[] = [];

  const numPages = pdf.numPages;
  const limit =
    typeof opts?.maxPages === 'number' && opts.maxPages > 0
      ? Math.min(numPages, opts.maxPages)
      : numPages;

  for (let pageNum = 1; pageNum <= limit; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const lines = itemsToLines(
      content.items as unknown as TextItem[],
      yTolerance,
    );
    allaRader.push(...lines);

    if (includePages) {
      pages.push({ page: pageNum, lines, artGroups: groupByArt(extractArtLines(lines)) });
    }
  }

  const artGroups = groupByArt(extractArtLines(allaRader));
  const sections = extractSections(allaRader);
  const totals = extractSpecTotals(allaRader);

  // Extract employee name from first page lines and add as art '0'
  const employeeName = extractEmployeeName(allaRader);
  if (employeeName) {
    artGroups.unshift({ art: '0', rows: [employeeName] });
  }

  return includePages
    ? { artGroups, sections, totals, pages }
    : { artGroups, sections, totals };
}
