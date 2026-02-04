// parseBlidosundsPayslip.ts

export type MoneySEK = number;

export type PayslipLine = {
  code: string;
  name?: string;

  dateFrom?: string;
  dateTo?: string;
  qty?: number;
  unitPriceSEK?: MoneySEK;
  percent?: number;

  amountSEK?: MoneySEK;
  raw?: string;
};

export type ArtGroup = {
  art: string;
  rows: string[];
};

export type ArtCountRow = {
  art: string;
  description: string; // t.ex. "Maskinskötseltillägg"
  count: number; // rows.length
};

export type PayslipAnalysis = {
  employer?: string;
  employeeName?: string;

  period?: { from: string; to: string };
  payoutDate?: string;

  costCenter?: string;
  employmentRatePercent?: number;

  taxTable?: string;
  preliminaryTaxPeriodSEK?: MoneySEK;

  grossPeriodSEK?: MoneySEK;
  netPaySEK?: MoneySEK;

  compHours?: number;
  annualWorkTimeHours?: number;

  // gamla rader (kan användas senare för belopp/datum)
  lines: PayslipLine[];

  // ✅ nya grejer från lilla parsen
  artGroups?: ArtGroup[];
  artCounts?: ArtCountRow[];

  baseSalarySEK?: MoneySEK;
  unionFeeSEK?: MoneySEK;
  grossFrom9991SEK?: MoneySEK;
  notes: string[];
};

// --- Helpers ---

function normalizeText(input: string) {
  return input.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\r/g, '').trim();
}

function parseSwedishNumberToFloat(raw: string): number | undefined {
  const s = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return undefined;
  return Number(s);
}

function pickDateRange(text: string): { from: string; to: string } | undefined {
  const m = text.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return undefined;
  return { from: m[1], to: m[2] };
}

function pickSingleDateAfterLabel(text: string, label: string): string | undefined {
  const re = new RegExp(`${label}\\s*(\\d{4}-\\d{2}-\\d{2})`, 'i');
  const m = text.match(re);
  return m?.[1];
}

function pickMoneyAfterLabel(text: string, label: string): number | undefined {
  const re = new RegExp(`${label}\\s*([-+]?\\d[\\d\\s]*,\\d{2})`, 'i');
  const m = text.match(re);
  if (!m) return undefined;
  return parseSwedishNumberToFloat(m[1]);
}

function pickIntAfterLabel(text: string, label: string): number | undefined {
  const re = new RegExp(`${label}\\s*(\\d[\\d\\s]*,\\d{2})`, 'i');
  const m = text.match(re);
  if (!m) return undefined;
  const n = parseSwedishNumberToFloat(m[1]);
  return typeof n === 'number' ? Math.round(n) : undefined;
}

function pickStringAfterLabel(text: string, label: string): string | undefined {
  const re = new RegExp(`${label}\\s*([A-Za-z0-9\\-]+)`, 'i');
  const m = text.match(re);
  return m?.[1];
}

function lastMoneyInString(raw: string): number | undefined {
  const nums = raw.match(/[-+]?\d[\d\s]*,\d{2}/g);
  if (!nums || !nums.length) return undefined;
  return parseSwedishNumberToFloat(nums[nums.length - 1]);
}

function extractPayslipLinesFromRawText(rawText: string): PayslipLine[] {
  const lines: PayslipLine[] = [];

  const candidates = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const raw of candidates) {
    const withDates = raw.match(
      /^([A-Za-z]?\d{2,6})\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})\s*(.*)$/
    );

    if (withDates) {
      const code = withDates[1];
      const name = withDates[2].trim();
      const dateFrom = withDates[3];
      const dateTo = withDates[4];
      const tail = (withDates[5] || '').trim();

      const nums = tail.match(/[-+]?\d[\d\s]*,\d{2}/g) || [];
      const amountRaw = nums.length ? nums[nums.length - 1] : undefined;
      const amount = amountRaw ? parseSwedishNumberToFloat(amountRaw) : undefined;
      if (typeof amount !== 'number') continue;

      const qtyRaw = nums.length >= 2 ? nums[0] : undefined;
      const qty = qtyRaw ? parseSwedishNumberToFloat(qtyRaw) : undefined;

      const unitPriceRaw = nums.length >= 3 ? nums[nums.length - 2] : undefined;
      const unitPrice = unitPriceRaw ? parseSwedishNumberToFloat(unitPriceRaw) : undefined;

      const percentMatch = tail.match(/(\d[\d\s]*,\d{2})\s*%/);
      const percent = percentMatch ? parseSwedishNumberToFloat(percentMatch[1]) : undefined;

      lines.push({
        code,
        name,
        dateFrom,
        dateTo,
        qty: typeof qty === 'number' ? qty : undefined,
        unitPriceSEK: typeof unitPrice === 'number' ? unitPrice : undefined,
        percent: typeof percent === 'number' ? percent : undefined,
        amountSEK: amount,
        raw,
      });

      continue;
    }

    const simple = raw.match(/^([A-Za-z]?\d{2,6})\s+(.+?)\s+([-+]?(\d[\d\s]*,\d{2}))\s*$/);
    if (simple) {
      const code = simple[1];
      const name = simple[2].trim();
      const amount = parseSwedishNumberToFloat(simple[3]);
      if (typeof amount !== 'number') continue;

      lines.push({ code, name, amountSEK: amount, raw });
      continue;
    }

    const fallback = raw.match(/^([A-Za-z]?\d{2,6})\s+(.+)$/);
    if (fallback) {
      const code = fallback[1];
      const rest = fallback[2].trim();
      const amount = lastMoneyInString(rest);
      if (typeof amount !== 'number') continue;

      const d = rest.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
      const name = d ? rest.slice(0, d.index).trim() : rest.replace(/[-+]?\d[\d\s]*,\d{2}\s*$/, '').trim();

      lines.push({
        code,
        name: name || undefined,
        dateFrom: d?.[1],
        dateTo: d?.[2],
        amountSEK: amount,
        raw,
      });
    }
  }

  return lines;
}

// ✅ plocka beskrivning från en raw art-rad
// "2101 Maskinskötseltillägg 2025-..." -> "Maskinskötseltillägg"
function descriptionFromRawRow(art: string, raw: string): string {
  let s = raw.trim();
  if (s.startsWith(art + ' ')) s = s.slice(art.length).trim();

  const dateIdx = s.search(/\d{4}-\d{2}-\d{2}/);
  if (dateIdx >= 0) s = s.slice(0, dateIdx).trim();

  // om PDF:en råkat klämma ihop konstigt, ta bort trailing extra spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s || 'Okänd';
}

function buildArtCountsFromArtGroups(artGroups: ArtGroup[]): ArtCountRow[] {
  return artGroups
    .map((g) => {
      const first = g.rows[0] ?? '';
      return {
        art: g.art,
        description: first ? descriptionFromRawRow(g.art, first) : 'Okänd',
        count: g.rows.length,
      };
    })
    .sort((a, b) => b.count - a.count);
}

// --- Main parser ---

export function parseBlidosundsPayslip(rawText: string, artGroups?: ArtGroup[]): PayslipAnalysis {
  const text = normalizeText(rawText);
  const notes: string[] = [];

  const analysis: PayslipAnalysis = {
    employer: 'Blidösundsbolaget AB',
    lines: [],
    notes,
  };

  // Period
  const period = pickDateRange(text);
  if (period) analysis.period = period;
  else notes.push('Kunde inte hitta period (YYYY-MM-DD - YYYY-MM-DD) i texten.');

  // Utbetalningsdag + netto
  analysis.payoutDate = pickSingleDateAfterLabel(text, 'Utbetalningsdag');
  analysis.netPaySEK = pickMoneyAfterLabel(text, 'Att utbetala');
  if (!analysis.netPaySEK) notes.push("Kunde inte hitta 'Att utbetala'.");

  // Skatteuppgifter
  analysis.taxTable = (text.match(/Skattetabell\s*(\d{1,2},\d{2})/i) || [])[1];
  analysis.preliminaryTaxPeriodSEK = pickMoneyAfterLabel(text, 'Preliminär skatt');

  // Övriga uppgifter
  analysis.costCenter = pickStringAfterLabel(text, 'Kostnadsställe');
  analysis.employmentRatePercent = pickIntAfterLabel(text, 'Sysselsättningsgrad');
  analysis.grossPeriodSEK = pickMoneyAfterLabel(text, 'Bruttolön perioden');

  // Tid (om finns)
  const kompMatch = text.match(/Komp\s*(\d[\d\s]*,\d{2})/i);
  if (kompMatch) analysis.compHours = parseSwedishNumberToFloat(kompMatch[1]);

  const arsMatch = text.match(/Årsarbetstid\s*(\d[\d\s]*,\d{2})/i);
  if (arsMatch) analysis.annualWorkTimeHours = parseSwedishNumberToFloat(arsMatch[1]);

  // gamla “lines” (kan användas senare för belopp/datum)
  analysis.lines = extractPayslipLinesFromRawText(rawText);

  // ✅ nya: artGroups + artCounts (source of truth för antal)
  if (artGroups?.length) {
    analysis.artGroups = artGroups;
    analysis.artCounts = buildArtCountsFromArtGroups(artGroups);
  } else {
    notes.push('artGroups saknas (pdfjs). Art-tabellen kan bli ofullständig tills pdfjs-parsen kopplas in.');
    analysis.artCounts = [];
  }

  // Derivates (behåller tills vidare)
  const findCode = (code: string) => analysis.lines.find((l) => l.code === code);
  analysis.baseSalarySEK = findCode('070')?.amountSEK;
  analysis.grossFrom9991SEK = findCode('9991')?.amountSEK;
  analysis.unionFeeSEK = findCode('960')?.amountSEK;

  return analysis;
}
