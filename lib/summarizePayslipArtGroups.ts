import type { ArtGroup } from '@/lib/parsePayslipArtGroups';

export type ParsedArtRow = {
  art: string;
  description?: string;
  dateFrom?: string;
  dateTo?: string;
  numbers: number[];
  raw: string;
};

export type ArtSummary315 = {
  art: '315';
  totalMinutes: number;
  datesISO: string[];
  monthISO: string | null;
};

export type ArtSummary2101 = {
  art: '2101';
  rowsCount: number;
  sekTotal: number;
};

export type PayslipArtOverview = {
  art315?: ArtSummary315;
  art2101?: ArtSummary2101;
  byArt: Array<{
    art: string;
    description: string;
    rowsCount: number;
  }>;
};

function normalizeSpaces(s: string) {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function descriptionFromRawRow(art: string, raw: string): string {
  let s = normalizeSpaces(raw);
  if (s.startsWith(art + ' ')) s = s.slice(art.length).trim();

  const dateIdx = s.search(/\d{4}-\d{2}-\d{2}/);
  if (dateIdx >= 0) s = s.slice(0, dateIdx).trim();

  s = s.replace(/\s+/g, ' ').trim();
  return s || 'Okänd';
}

function parseSwedishNumber(raw: string): number | undefined {
  const s = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function extractAllSwedishNumbers(text: string): number[] {
  const matches = text.match(/[-+]?\d[\d\s]*,\d{1,2}/g) || [];
  const out: number[] = [];
  for (const m of matches) {
    const n = parseSwedishNumber(m);
    if (typeof n === 'number') out.push(n);
  }
  return out;
}

function ymFromISO(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

function parseISODate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Validate round-trip
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function isoFromUTCDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function expandISODateRange(fromISO: string, toISO: string): string[] {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return [];

  const out: string[] = [];
  const dir = from.getTime() <= to.getTime() ? 1 : -1;

  // Guard to avoid infinite loops on weird input.
  const maxDays = 370;
  const cur = new Date(from);

  for (let i = 0; i < maxDays; i++) {
    out.push(isoFromUTCDate(cur));
    if (isoFromUTCDate(cur) === isoFromUTCDate(to)) break;
    cur.setUTCDate(cur.getUTCDate() + dir);
  }

  return out;
}

function pickBestMonthISO(datesISO: string[]): string | null {
  const counts = new Map<string, number>();
  for (const d of datesISO) {
    const ym = ymFromISO(d);
    if (!ym) continue;
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [ym, n] of counts) {
    if (n > bestN) {
      best = ym;
      bestN = n;
    }
  }
  return best;
}

function parse315MinutesFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  // Collect numeric tokens after the date range.
  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  if (!tokens.length) return null;

  // 315 is "time". Pick the first token that looks like plausible hours.
  // This avoids accidentally picking huge totals sometimes glued into the same line.
  for (const tok of tokens) {
    const t = tok.trim();
    const hasExplicitSign = /^[+-]/.test(t);
    const n = parseSwedishNumber(t);
    if (typeof n !== 'number') continue;

    let hours = n;
    if (!hasExplicitSign && hours < 0) hours = Math.abs(hours);

    // Plausibility: nominal worked time per day.
    if (hours < 0 || hours > 24) continue;

    const minutes = Math.round(hours * 60);
    return minutes;
  }

  return null;
}

export function parseArtRow(raw: string): ParsedArtRow | null {
  const s = normalizeSpaces(raw);
  const artMatch = s.match(/^(\d{2,5})\s+/);
  if (!artMatch) return null;

  const art = artMatch[1];
  const desc = descriptionFromRawRow(art, s);

  const dateMatch = s.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  const numbers = extractAllSwedishNumbers(s);

  return {
    art,
    description: desc,
    dateFrom: dateMatch?.[1],
    dateTo: dateMatch?.[2],
    numbers,
    raw: s,
  };
}

export function summarizePayslipArtGroups(artGroups: ArtGroup[]): PayslipArtOverview {
  const byArt = artGroups
    .map((g) => ({
      art: g.art,
      description: descriptionFromRawRow(g.art, g.rows?.[0] ?? ''),
      rowsCount: g.rows?.length ?? 0,
    }))
    .sort((a, b) => b.rowsCount - a.rowsCount);

  const art315Group = artGroups.find((g) => g.art === '315');
  const art2101Group = artGroups.find((g) => g.art === '2101');

  const overview: PayslipArtOverview = { byArt };

  // 315: Årsarbetstid, nominell → summera arbetad tid (första siffran efter datum-intervall brukar vara timmar)
  if (art315Group?.rows?.length) {
    let totalMinutes = 0;
    const dates = new Set<string>();

    for (const row of art315Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed) continue;

      // Datum: markera alla dagar i intervallet (oftast samma dag).
      if (parsed.dateFrom && parsed.dateTo) {
        for (const d of expandISODateRange(parsed.dateFrom, parsed.dateTo)) dates.add(d);
      }

      // Tid: robust parsing efter datumintervallet.
      const minutes = parse315MinutesFromRawRow(row);
      if (typeof minutes === 'number') totalMinutes += minutes;
    }

    // Clamp: total får aldrig bli negativ.
    if (totalMinutes < 0) totalMinutes = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);

    overview.art315 = { art: '315', totalMinutes, datesISO, monthISO };
  }

  // 2101: Maskinskötseltillägg → antal rader + summera SEK (oftast sista talet på raden i era exempel)
  if (art2101Group?.rows?.length) {
    let sekTotal = 0;

    for (const row of art2101Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed) continue;

      const last = parsed.numbers.length ? parsed.numbers[parsed.numbers.length - 1] : undefined;
      if (typeof last === 'number') sekTotal += last;
    }

    overview.art2101 = {
      art: '2101',
      rowsCount: art2101Group.rows.length,
      sekTotal,
    };
  }

  return overview;
}
