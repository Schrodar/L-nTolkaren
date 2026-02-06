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

export type ArtSummary311 = {
  art: '311';
  totalMinutes: number;
  datesISO: string[];
  monthISO: string | null;
  minutesByDateISO: Record<string, number>;
};

export type ArtSummary301 = {
  art: '301';
  rowsCount: number;
  totalMinutes: number;
  datesISO: string[];
  monthISO: string | null;
  minutesByDateISO: Record<string, number>;
  hoursTotal: number;
  sekPerHour: number | null;
  sekTotalComputed: number;
  sekTotalFromRow: number | null;
  hoursByDateISO: Record<string, number>;
  sekByDateISO: Record<string, number>;
};

export type ArtSummary31101 = {
  art: '31101';
  totalMinutes: number;
  datesISO: string[];
  monthISO: string | null;
  minutesByDateISO: Record<string, number>;
};

export type ArtSummary312 = {
  art: '312';
  totalMinutes: number;
  datesISO: string[];
  monthISO: string | null;
  minutesByDateISO: Record<string, number>;
};

export type ArtSummary31201 = {
  art: '31201';
  totalMinutes: number;
  datesISO: string[];
  monthISO: string | null;
  minutesByDateISO: Record<string, number>;
};

export type ArtSummary2101 = {
  art: '2101';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary9001 = {
  art: '9001';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary9002 = {
  art: '9002';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary0641 = {
  art: '0641';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary0644 = {
  art: '0644';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary070 = {
  art: '070';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary4851 = {
  art: '4851';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary350 = {
  art: '350';
  rowsCount: number;
  hoursTotal: number;
  sekPerHour: number | null;
  sekTotalComputed: number;
};

export type ArtSummary70001 = {
  art: '70001';
  rowsCount: number;
  daysTotal: number;
  sekPerDay: number | null;
  sekTotalComputed: number;
};

export type ArtSummaryK7022 = {
  art: 'K7022';
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummaryK315 = {
  art: 'K315';
  rowsCount: number;
  datesISO: string[];
  monthISO: string | null;
  hoursTotal: number;
  hoursByDateISO: Record<string, number>;
};

export type FackforeningsavgiftSummary = {
  rowsCount: number;
  sekTotal: number;
};

export type FriskvardSummary = {
  rowsCount: number;
  sekTotal: number;
};

export type ArtSummary320 = {
  art: '320';
  rowsCount: number;
  hoursTotal: number;
  sekPerHour: number | null;
  sekTotalComputed: number;
  sekTotalFromRow: number | null;
};

export type ArtSummary302 = {
  art: '302';
  rowsCount: number;
  datesISO: string[];
  monthISO: string | null;
  hoursTotal: number;
  sekPerHour: number | null;
  sekTotalComputed: number;
  sekTotalFromRow: number | null;
  hoursByDateISO: Record<string, number>;
  sekByDateISO: Record<string, number>;
};

export type ArtSummary700 = {
  art: '700';
  rowsCount: number;
  datesISO: string[];
  monthISO: string | null;
};

export type ArtSummary810 = {
  art: '810';
  rowsCount: number;
  datesISO: string[];
  monthISO: string | null;
  hoursTotal: number;
  hoursByDateISO: Record<string, number>;
};

export type ArtSummary81001 = {
  art: '81001';
  rowsCount: number;
  datesISO: string[];
  monthISO: string | null;
  hoursTotal: number;
  sekPerHour: number | null;
  sekTotalComputed: number;
  sekTotalFromRow: number | null;
  hoursByDateISO: Record<string, number>;
  sekByDateISO: Record<string, number>;
};

export type PayslipArtOverview = {
  art315?: ArtSummary315;
  art311?: ArtSummary311;
  art301?: ArtSummary301;
  art31101?: ArtSummary31101;
  art312?: ArtSummary312;
  art31201?: ArtSummary31201;
  art320?: ArtSummary320;
  art302?: ArtSummary302;
  art700?: ArtSummary700;
  art810?: ArtSummary810;
  art81001?: ArtSummary81001;
  art2101?: ArtSummary2101;
  art9001?: ArtSummary9001;
  art9002?: ArtSummary9002;
  art0641?: ArtSummary0641;
  art0644?: ArtSummary0644;
  art070?: ArtSummary070;
  art4851?: ArtSummary4851;
  art350?: ArtSummary350;
  art70001?: ArtSummary70001;
  artK7022?: ArtSummaryK7022;
  artK315?: ArtSummaryK315;
  fackforeningsavgift?: FackforeningsavgiftSummary;
  friskvard?: FriskvardSummary;
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

function parse9001TabellskattFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);

  // Primary: explicit value after the word "Tabellskatt".
  const m = s.match(/Tabellskatt\s+([-+]?\d[\d\s]*,\d{1,2})/i);
  if (m?.[1]) {
    const n = parseSwedishNumber(m[1]);
    if (typeof n === 'number') return n;
  }

  // Fallback: pick the last Swedish-formatted number on the row.
  // Note: extractAllSwedishNumbers ignores the art number (no comma), so this is usually safe.
  const nums = extractAllSwedishNumbers(s);
  if (nums.length) return nums[nums.length - 1];

  return null;
}

function parse9002EngangsskattFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);

  // Primary: explicit value after the word "Engångsskatt".
  const m = s.match(/Engångsskatt\s+([-+]?\d[\d\s]*,\d{1,2})/i);
  if (m?.[1]) {
    const n = parseSwedishNumber(m[1]);
    if (typeof n === 'number') return n;
  }

  // Fallback: last Swedish-formatted number on the row.
  const nums = extractAllSwedishNumbers(s);
  if (nums.length) return nums[nums.length - 1];
  return null;
}

function parseFackforeningsavgiftFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);

  // Primary: explicit value after the word "Fackföreningsavgift".
  const m = s.match(/Fackföreningsavgift\s+([-+]?\d[\d\s]*,\d{1,2})/i);
  if (m?.[1]) {
    const n = parseSwedishNumber(m[1]);
    if (typeof n === 'number') return n;
  }

  // Fallback: last Swedish number on the row.
  const nums = extractAllSwedishNumbers(s);
  if (nums.length) return nums[nums.length - 1];
  return null;
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

function parse311HoursFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  if (!tokens.length) return null;

  const candidates: number[] = [];
  for (const tok of tokens) {
    const n = parseSwedishNumber(tok.trim());
    if (typeof n !== 'number') continue;
    if (n < 0 || n > 24) continue;
    candidates.push(n);
  }
  if (!candidates.length) return null;

  // Heuristik: välj den högra (sista) som inte är 0 om möjligt.
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (candidates[i] !== 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function parse301HoursFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  // 301: första siffran efter datumintervallet är timmar (svenskt kommatecken), resten är ofta satser/belopp.
  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  for (const tok of tokens) {
    const n = parseSwedishNumber(tok.trim());
    if (typeof n !== 'number') continue;
    if (n < 0 || n > 24) continue;
    return n;
  }
  return null;
}

function parse31101HoursFromRawRow(raw: string): number | null {
  // 31101: första siffran efter datumintervallet är timmar (komptid efter omräkning), t.ex. 15,16
  return parse301HoursFromRawRow(raw);
}

function parse312HoursFromRawRow(raw: string): number | null {
  // 312: kvalificerad övertid till komp – timmar efter datumintervallet.
  // Exempel: "312 Kval.övertid till komp 2 2025-12-20 - 2025-12-20 5,58 0,00"
  return parse311HoursFromRawRow(raw);
}

function parse31201HoursFromRawRow(raw: string): number | null {
  // 31201: första siffran efter datumintervallet är timmar (komptid efter omräkning), t.ex. 15,16
  return parse301HoursFromRawRow(raw);
}

function parse810HoursFromRawRow(raw: string): number | null {
  // 810/81001: första siffran efter datumintervallet är timmar.
  return parse301HoursFromRawRow(raw);
}

function parse81001FromRawRow(raw: string): { dateFrom: string; dateTo: string; hours: number; sekPerHour?: number; sekTotalFromRow?: number } | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const dateFrom = dm[1];
  const dateTo = dm[2];

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  const hours = parse810HoursFromRawRow(raw);
  if (typeof hours !== 'number' || !Number.isFinite(hours)) return null;

  // Belopp: leta efter "Tim" och plocka siffror efter, men ignorera procent (t.ex. 41,67%).
  const timIdx = after.search(/\bTim\b/i);
  if (timIdx < 0) return { dateFrom, dateTo, hours };

  const afterTim = after.slice(timIdx + 3);
  const afterTimNoPercent = afterTim.replace(/\b\d+(?:\s\d{3})*,\d{1,2}\s*%/g, ' ');

  const tokens = afterTimNoPercent.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  const nums: number[] = [];
  for (const tok of tokens) {
    const n = parseSwedishNumber(tok.trim());
    if (typeof n === 'number' && Number.isFinite(n)) nums.push(n);
  }

  const sekPerHour = nums.length ? nums[0] : undefined;
  const sekTotalFromRow = nums.length >= 2 ? nums[nums.length - 1] : undefined;

  return { dateFrom, dateTo, hours, sekPerHour, sekTotalFromRow };
}

function parse350FromRawRow(raw: string): { hours: number; sekPerHour: number } | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  if (tokens.length < 2) return null;

  const t0 = tokens[0];
  const t1 = tokens[1];
  if (!t0 || !t1) return null;

  const hours = parseSwedishNumber(t0.trim());
  const sekPerHour = parseSwedishNumber(t1.trim());
  if (typeof hours !== 'number' || typeof sekPerHour !== 'number') return null;
  if (!Number.isFinite(hours) || !Number.isFinite(sekPerHour)) return null;

  if (hours < 0 || hours > 24) return null;
  if (sekPerHour < 0 || sekPerHour > 100000) return null;
  return { hours, sekPerHour };
}

function parse320FromRawRow(raw: string): { hours: number; sekPerHour: number; sekTotalFromRow?: number } | null {
  const s = normalizeSpaces(raw);
  const m = s.match(/\bpengar\b/i);
  if (!m || m.index == null) return null;

  const after = s.slice(m.index + m[0].length).trim();
  if (!after) return null;

  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  if (!tokens[0] || !tokens[1]) return null;

  const hours = parseSwedishNumber(tokens[0].trim());
  const sekPerHour = parseSwedishNumber(tokens[1].trim());
  if (typeof hours !== 'number' || typeof sekPerHour !== 'number') return null;
  if (!Number.isFinite(hours) || !Number.isFinite(sekPerHour)) return null;
  if (hours <= 0 || hours > 500) return null;
  if (sekPerHour <= 0 || sekPerHour > 10000) return null;

  // Ofta står totalen som tredje token, men det kan även komma fler siffror efter.
  let sekTotalFromRow: number | undefined;
  for (let i = tokens.length - 1; i >= 2; i--) {
    const n = parseSwedishNumber(tokens[i].trim());
    if (typeof n !== 'number') continue;
    if (n > sekPerHour && n > hours) {
      sekTotalFromRow = n;
      break;
    }
  }

  return { hours, sekPerHour, sekTotalFromRow };
}

function parse301FromRawRow(
  raw: string
): { dateFrom: string; dateTo: string; hours: number; sekPerHour: number; sekTotalFromRow?: number } | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const dateFrom = dm[1];
  const dateTo = dm[2];

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  // För ART 301 förväntar vi oss: <timmar> <timbelopp> <utbetalt>
  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  if (!tokens[0] || !tokens[1]) return null;

  const hours = parseSwedishNumber(tokens[0].trim());
  const sekPerHour = parseSwedishNumber(tokens[1].trim());
  if (typeof hours !== 'number' || typeof sekPerHour !== 'number') return null;
  if (!Number.isFinite(hours) || !Number.isFinite(sekPerHour)) return null;

  if (hours < 0 || hours > 500) return null;
  if (sekPerHour < 0 || sekPerHour > 100000) return null;

  let sekTotalFromRow: number | undefined;
  for (let i = tokens.length - 1; i >= 2; i--) {
    const n = parseSwedishNumber(tokens[i].trim());
    if (typeof n !== 'number') continue;
    if (!Number.isFinite(n)) continue;
    sekTotalFromRow = n;
    break;
  }

  return { dateFrom, dateTo, hours, sekPerHour, sekTotalFromRow };
}

function parse302FromRawRow(
  raw: string
): { dateFrom: string; dateTo: string; hours: number; sekPerHour: number; sekTotalFromRow?: number } | null {
  const s = normalizeSpaces(raw);
  const dateRe = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
  const dm = s.match(dateRe);
  if (!dm || dm.index == null) return null;

  const dateFrom = dm[1];
  const dateTo = dm[2];

  const after = s.slice(dm.index + dm[0].length).trim();
  if (!after) return null;

  // För ART 302 förväntar vi oss: <timmar> <timbelopp> <utbetalt>
  const tokens = after.match(/[-+]?\d+(?:\s\d{3})*(?:,\d{1,2})?/g) || [];
  if (!tokens[0] || !tokens[1]) return null;

  const hours = parseSwedishNumber(tokens[0].trim());
  const sekPerHour = parseSwedishNumber(tokens[1].trim());
  if (typeof hours !== 'number' || typeof sekPerHour !== 'number') return null;
  if (!Number.isFinite(hours) || !Number.isFinite(sekPerHour)) return null;

  // Rimlighetskontroller: tillåt små decimaler men skydda mot skräp.
  if (hours < 0 || hours > 500) return null;
  if (sekPerHour < 0 || sekPerHour > 100000) return null;

  let sekTotalFromRow: number | undefined;
  for (let i = tokens.length - 1; i >= 2; i--) {
    const n = parseSwedishNumber(tokens[i].trim());
    if (typeof n !== 'number') continue;
    if (!Number.isFinite(n)) continue;
    sekTotalFromRow = n;
    break;
  }

  return { dateFrom, dateTo, hours, sekPerHour, sekTotalFromRow };
}

export function parseArtRow(raw: string): ParsedArtRow | null {
  const s = normalizeSpaces(raw);
  const artMatch = s.match(/^(\d{2,5}|K\d{3,5})\s+/);
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

function parseSekAfterDateRangeFromRawRow(raw: string): number | null {
  const s = normalizeSpaces(raw);

  const m = s.match(/\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}(.*)$/);
  const after = m?.[1] ? m[1].trim() : '';
  if (after) {
    const numsAfter = extractAllSwedishNumbers(after);
    if (numsAfter.length) return numsAfter[numsAfter.length - 1];
  }

  const nums = extractAllSwedishNumbers(s);
  if (nums.length) return nums[nums.length - 1];
  return null;
}

function parse70001SemestertillaggFromRawRow(raw: string): { days: number; sekPerDay: number } | null {
  const s = normalizeSpaces(raw);

  const m = s.match(/\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}(.*)$/);
  const after = m?.[1] ? m[1].trim() : '';
  if (!after) return null;

  const nums = extractAllSwedishNumbers(after);
  if (nums.length < 2) return null;

  const days = nums[0];
  const sekPerDay = nums[1];

  if (!Number.isFinite(days) || !Number.isFinite(sekPerDay)) return null;
  if (days < 0 || days > 370) return null;
  if (sekPerDay < 0 || sekPerDay > 100000) return null;

  return { days, sekPerDay };
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
  const art311Group = artGroups.find((g) => g.art === '311');
  const art301Group = artGroups.find((g) => g.art === '301');
  const art31101Group = artGroups.find((g) => g.art === '31101');
  const art312Group = artGroups.find((g) => g.art === '312');
  const art31201Group = artGroups.find((g) => g.art === '31201');
  const art302Group = artGroups.find((g) => g.art === '302');
  const art700Group = artGroups.find((g) => g.art === '700');
  const art810Group = artGroups.find((g) => g.art === '810');
  const art81001Group = artGroups.find((g) => g.art === '81001');
  const art320Group = artGroups.find((g) => g.art === '320');
  const art2101Group = artGroups.find((g) => g.art === '2101');
  const art9001Group = artGroups.find((g) => g.art === '9001');
  const art9002Group = artGroups.find((g) => g.art === '9002');
  const art0641Group = artGroups.find((g) => g.art === '0641');
  const art0644Group = artGroups.find((g) => g.art === '0644');
  const art070Group = artGroups.find((g) => g.art === '070');
  const art4851Group = artGroups.find((g) => g.art === '4851');
  const art350Group = artGroups.find((g) => g.art === '350');
  const art70001Group = artGroups.find((g) => g.art === '70001');
  const artK7022Group = artGroups.find((g) => g.art === 'K7022');
  const artK315Group = artGroups.find((g) => g.art === 'K315');
  const art9190Group = artGroups.find((g) => g.art === '9190');
  const artK5441Group = artGroups.find((g) => g.art === 'K5441');

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

  // 311: Enkel övertid till komp (timmar) + datumintervall. Markera dagar och visa timmar vid hover.
  if (art311Group?.rows?.length) {
    let totalMinutes = 0;
    const dates = new Set<string>();
    const minutesByDateISO: Record<string, number> = {};

    for (const row of art311Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse311HoursFromRawRow(row);
      if (typeof hours !== 'number') continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      const minutesTotal = Math.round(hours * 60);
      totalMinutes += minutesTotal;

      const perDay = Math.round(minutesTotal / expanded.length);
      for (const d of expanded) {
        dates.add(d);
        minutesByDateISO[d] = (minutesByDateISO[d] ?? 0) + perDay;
      }
    }

    if (totalMinutes < 0) totalMinutes = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);
    overview.art311 = { art: '311', totalMinutes, datesISO, monthISO, minutesByDateISO };
  }

  // 301: Övertid (utbetald) – timmar = första siffran efter datumintervallet.
  if (art301Group?.rows?.length) {
    let totalMinutes = 0;
    let hoursTotal = 0;
    let sekTotalComputed = 0;
    let sekTotalFromRow = 0;
    let fromRowCount = 0;

    const dates = new Set<string>();
    const minutesByDateISO: Record<string, number> = {};
    const hoursByDateISO: Record<string, number> = {};
    const sekByDateISO: Record<string, number> = {};

    let sekPerHour: number | null = null;
    const sameRateEps = 0.005;

    for (const row of art301Group.rows) {
      const parsed = parse301FromRawRow(row);
      if (!parsed) continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      hoursTotal += parsed.hours;
      const computed = Math.round(parsed.hours * parsed.sekPerHour * 100) / 100;
      sekTotalComputed += computed;

      if (typeof parsed.sekTotalFromRow === 'number') {
        sekTotalFromRow += parsed.sekTotalFromRow;
        fromRowCount++;
      }

      if (sekPerHour == null) {
        sekPerHour = parsed.sekPerHour;
      } else if (Math.abs(sekPerHour - parsed.sekPerHour) > sameRateEps) {
        sekPerHour = null;
      }

      const minutesTotal = Math.round(parsed.hours * 60);
      totalMinutes += minutesTotal;

      const perDay = Math.round(minutesTotal / expanded.length);
      const perDayHours = parsed.hours / expanded.length;
      const perDaySek = computed / expanded.length;
      for (const d of expanded) {
        dates.add(d);
        minutesByDateISO[d] = (minutesByDateISO[d] ?? 0) + perDay;
        hoursByDateISO[d] = (hoursByDateISO[d] ?? 0) + perDayHours;
        sekByDateISO[d] = (sekByDateISO[d] ?? 0) + perDaySek;
      }
    }

    if (totalMinutes < 0) totalMinutes = 0;
    if (hoursTotal < 0) hoursTotal = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);
    overview.art301 = {
      art: '301',
      rowsCount: art301Group.rows.length,
      totalMinutes,
      datesISO,
      monthISO,
      minutesByDateISO,
      hoursTotal: Math.round(hoursTotal * 100) / 100,
      sekPerHour,
      sekTotalComputed: Math.round(sekTotalComputed * 100) / 100,
      sekTotalFromRow: fromRowCount ? Math.round(sekTotalFromRow * 100) / 100 : null,
      hoursByDateISO,
      sekByDateISO,
    };
  }

  // 31101: Övertid, omräkning okvalificerad (komptid) – timmar = första siffran efter datumintervallet.
  if (art31101Group?.rows?.length) {
    let totalMinutes = 0;
    const dates = new Set<string>();
    const minutesByDateISO: Record<string, number> = {};

    for (const row of art31101Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse31101HoursFromRawRow(row);
      if (typeof hours !== 'number') continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      const minutesTotal = Math.round(hours * 60);
      totalMinutes += minutesTotal;

      const perDay = Math.round(minutesTotal / expanded.length);
      for (const d of expanded) {
        dates.add(d);
        minutesByDateISO[d] = (minutesByDateISO[d] ?? 0) + perDay;
      }
    }

    if (totalMinutes < 0) totalMinutes = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);
    overview.art31101 = { art: '31101', totalMinutes, datesISO, monthISO, minutesByDateISO };
  }

  // 312: Kvalificerad övertid till komp – timmar efter datumintervallet.
  if (art312Group?.rows?.length) {
    let totalMinutes = 0;
    const dates = new Set<string>();
    const minutesByDateISO: Record<string, number> = {};

    for (const row of art312Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse312HoursFromRawRow(row);
      if (typeof hours !== 'number') continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      const minutesTotal = Math.round(hours * 60);
      totalMinutes += minutesTotal;

      const perDay = Math.round(minutesTotal / expanded.length);
      for (const d of expanded) {
        dates.add(d);
        minutesByDateISO[d] = (minutesByDateISO[d] ?? 0) + perDay;
      }
    }

    if (totalMinutes < 0) totalMinutes = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);
    overview.art312 = { art: '312', totalMinutes, datesISO, monthISO, minutesByDateISO };
  }

  // 31201: Övertid, omräkning helgdag (komptid) – timmar = första siffran efter datumintervallet.
  if (art31201Group?.rows?.length) {
    let totalMinutes = 0;
    const dates = new Set<string>();
    const minutesByDateISO: Record<string, number> = {};

    for (const row of art31201Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse31201HoursFromRawRow(row);
      if (typeof hours !== 'number') continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      const minutesTotal = Math.round(hours * 60);
      totalMinutes += minutesTotal;

      const perDay = Math.round(minutesTotal / expanded.length);
      for (const d of expanded) {
        dates.add(d);
        minutesByDateISO[d] = (minutesByDateISO[d] ?? 0) + perDay;
      }
    }

    if (totalMinutes < 0) totalMinutes = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);
    overview.art31201 = { art: '31201', totalMinutes, datesISO, monthISO, minutesByDateISO };
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

  // 302: Övertid, kvalificerad → datumintervall + timmar + timbelopp + total.
  // Exempelrad: "302 Övertid, kvalificerad 2025-12-31 - 2025-12-31 0,25 474,25 118,56"
  if (art302Group?.rows?.length) {
    let hoursTotal = 0;
    let sekTotalComputed = 0;
    let sekTotalFromRow = 0;
    let fromRowCount = 0;

    const dates = new Set<string>();
    const hoursByDateISO: Record<string, number> = {};
    const sekByDateISO: Record<string, number> = {};

    let sekPerHour: number | null = null;
    const sameRateEps = 0.005;

    for (const row of art302Group.rows) {
      const parsed = parse302FromRawRow(row);
      if (!parsed) continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      hoursTotal += parsed.hours;
      const computed = Math.round(parsed.hours * parsed.sekPerHour * 100) / 100;
      sekTotalComputed += computed;

      if (typeof parsed.sekTotalFromRow === 'number') {
        sekTotalFromRow += parsed.sekTotalFromRow;
        fromRowCount++;
      }

      if (sekPerHour == null) {
        sekPerHour = parsed.sekPerHour;
      } else if (Math.abs(sekPerHour - parsed.sekPerHour) > sameRateEps) {
        sekPerHour = null;
      }

      const perDayHours = parsed.hours / expanded.length;
      const perDaySek = computed / expanded.length;
      for (const d of expanded) {
        dates.add(d);
        hoursByDateISO[d] = (hoursByDateISO[d] ?? 0) + perDayHours;
        sekByDateISO[d] = (sekByDateISO[d] ?? 0) + perDaySek;
      }
    }

    // Sanity/clamp
    if (hoursTotal < 0) hoursTotal = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);

    overview.art302 = {
      art: '302',
      rowsCount: art302Group.rows.length,
      datesISO,
      monthISO,
      hoursTotal,
      sekPerHour,
      sekTotalComputed: Math.round(sekTotalComputed * 100) / 100,
      sekTotalFromRow: fromRowCount ? Math.round(sekTotalFromRow * 100) / 100 : null,
      hoursByDateISO,
      sekByDateISO,
    };
  }

  // 700: Semester (uttagsordning betald/sparad/obetald) → bara datumintervall som ska markeras i kalendern.
  // Exempelrad: "700 Semester (...) 2025-12-24 - 2025-12-31 8,00 Kald 0,00"
  if (art700Group?.rows?.length) {
    const dates = new Set<string>();
    for (const row of art700Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;
      for (const d of expandISODateRange(parsed.dateFrom, parsed.dateTo)) dates.add(d);
    }

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);

    overview.art700 = {
      art: '700',
      rowsCount: art700Group.rows.length,
      datesISO,
      monthISO,
    };
  }

  // 810: Vård av barn (VAB) → datumintervall + timmar (tiden som dras av). Procent efter "Tim" ignoreras.
  if (art810Group?.rows?.length) {
    let hoursTotal = 0;
    const dates = new Set<string>();
    const hoursByDateISO: Record<string, number> = {};

    for (const row of art810Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse810HoursFromRawRow(row);
      if (typeof hours !== 'number' || !Number.isFinite(hours)) continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      hoursTotal += hours;
      const perDay = hours / expanded.length;
      for (const d of expanded) {
        dates.add(d);
        hoursByDateISO[d] = (hoursByDateISO[d] ?? 0) + perDay;
      }
    }

    if (hoursTotal < 0) hoursTotal = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);

    overview.art810 = {
      art: '810',
      rowsCount: art810Group.rows.length,
      datesISO,
      monthISO,
      hoursTotal,
      hoursByDateISO,
    };
  }

  // 81001: Vård av barn, tim → datumintervall + timmar + belopp. Vi visar total summa (avdrag) + tid.
  if (art81001Group?.rows?.length) {
    let hoursTotal = 0;
    let sekTotalComputed = 0;
    let sekTotalFromRow = 0;
    let fromRowCount = 0;

    const dates = new Set<string>();
    const hoursByDateISO: Record<string, number> = {};
    const sekByDateISO: Record<string, number> = {};

    let sekPerHour: number | null = null;
    const sameRateEps = 0.005;

    for (const row of art81001Group.rows) {
      const parsed = parse81001FromRawRow(row);
      if (!parsed) continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      hoursTotal += parsed.hours;

      const rate = typeof parsed.sekPerHour === 'number' && Number.isFinite(parsed.sekPerHour) ? parsed.sekPerHour : null;
      if (rate != null) {
        if (sekPerHour == null) {
          sekPerHour = rate;
        } else if (Math.abs(sekPerHour - rate) > sameRateEps) {
          sekPerHour = null;
        }
      }

      const computed = rate != null ? Math.round(parsed.hours * rate * 100) / 100 : 0;
      sekTotalComputed += computed;

      const totalForRow =
        typeof parsed.sekTotalFromRow === 'number' && Number.isFinite(parsed.sekTotalFromRow)
          ? parsed.sekTotalFromRow
          : computed;

      if (typeof parsed.sekTotalFromRow === 'number' && Number.isFinite(parsed.sekTotalFromRow)) {
        sekTotalFromRow += parsed.sekTotalFromRow;
        fromRowCount++;
      }

      const perDayHours = parsed.hours / expanded.length;
      const perDaySek = totalForRow / expanded.length;
      for (const d of expanded) {
        dates.add(d);
        hoursByDateISO[d] = (hoursByDateISO[d] ?? 0) + perDayHours;
        sekByDateISO[d] = (sekByDateISO[d] ?? 0) + perDaySek;
      }
    }

    if (hoursTotal < 0) hoursTotal = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);

    overview.art81001 = {
      art: '81001',
      rowsCount: art81001Group.rows.length,
      datesISO,
      monthISO,
      hoursTotal,
      sekPerHour,
      sekTotalComputed: Math.round(sekTotalComputed * 100) / 100,
      sekTotalFromRow: fromRowCount ? Math.round(sekTotalFromRow * 100) / 100 : null,
      hoursByDateISO,
      sekByDateISO,
    };
  }

  // K315: Långdagstillägg → första siffran efter datumintervallet är timmar (t.ex. 0,10).
  // Exempel: "K315 Långdagstillägg 2025-12-16 - 2025-12-16 0,10 0,00"
  if (artK315Group?.rows?.length) {
    let hoursTotal = 0;
    const dates = new Set<string>();
    const hoursByDateISO: Record<string, number> = {};

    for (const row of artK315Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse301HoursFromRawRow(row);
      if (typeof hours !== 'number' || !Number.isFinite(hours)) continue;

      const expanded = expandISODateRange(parsed.dateFrom, parsed.dateTo);
      if (!expanded.length) continue;

      hoursTotal += hours;
      const perDay = hours / expanded.length;
      for (const d of expanded) {
        dates.add(d);
        hoursByDateISO[d] = (hoursByDateISO[d] ?? 0) + perDay;
      }
    }

    if (hoursTotal < 0) hoursTotal = 0;

    const datesISO = Array.from(dates).sort();
    const monthISO = pickBestMonthISO(datesISO);

    overview.artK315 = {
      art: 'K315',
      rowsCount: artK315Group.rows.length,
      datesISO,
      monthISO,
      hoursTotal: Math.round(hoursTotal * 100) / 100,
      hoursByDateISO,
    };
  }

  // 320: Omvandling av innestående komp till pengar.
  // Format: "... till pengar <timmar> <timbelopp> ... <utbetalt>". Vi tar timmar+timbelopp direkt efter ordet "pengar".
  if (art320Group?.rows?.length) {
    let hoursTotal = 0;
    let sekTotalComputed = 0;
    let sekTotalFromRow = 0;
    let fromRowCount = 0;

    let sekPerHour: number | null = null;
    const sameRateEps = 0.005;

    for (const row of art320Group.rows) {
      const parsed = parse320FromRawRow(row);
      if (!parsed) continue;

      hoursTotal += parsed.hours;
      const computed = Math.round(parsed.hours * parsed.sekPerHour * 100) / 100;
      sekTotalComputed += computed;

      if (typeof parsed.sekTotalFromRow === 'number') {
        sekTotalFromRow += parsed.sekTotalFromRow;
        fromRowCount++;
      }

      if (sekPerHour == null) {
        sekPerHour = parsed.sekPerHour;
      } else if (Math.abs(sekPerHour - parsed.sekPerHour) > sameRateEps) {
        sekPerHour = null;
      }
    }

    if (hoursTotal > 0) {
      overview.art320 = {
        art: '320',
        rowsCount: art320Group.rows.length,
        hoursTotal,
        sekPerHour,
        sekTotalComputed: Math.round(sekTotalComputed * 100) / 100,
        sekTotalFromRow: fromRowCount ? Math.round(sekTotalFromRow * 100) / 100 : null,
      };
    }
  }

  // 9001: Tabellskatt → plocka ut beloppet som kommer efter ordet "Tabellskatt".
  // Exempel: "9001 Tabellskatt -4 289,00"
  if (art9001Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of art9001Group.rows) {
      const n = parse9001TabellskattFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.art9001 = {
        art: '9001',
        rowsCount: art9001Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // 9002: Engångsskatt → plocka ut beloppet som kommer efter ordet "Engångsskatt".
  // Exempel: "9002 Engångsskatt -6 224,00"
  if (art9002Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of art9002Group.rows) {
      const n = parse9002EngangsskattFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.art9002 = {
        art: '9002',
        rowsCount: art9002Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // 0641: 1e Däckmanstillägg → endast beloppet efter datumintervallet.
  // Exempel: "0641 1e Däckmanstillägg 2026-01-01 - 2026-01-31 2 721,00"
  if (art0641Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of art0641Group.rows) {
      const n = parseSekAfterDateRangeFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.art0641 = {
        art: '0641',
        rowsCount: art0641Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // 0644: Rederitillägg → endast beloppet efter datumintervallet.
  // Exempel: "0644 Rederitillägg 2026-01-01 - 2026-01-31 655,00"
  if (art0644Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of art0644Group.rows) {
      const n = parseSekAfterDateRangeFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.art0644 = {
        art: '0644',
        rowsCount: art0644Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // 070: Månadslön → endast beloppet efter datumintervallet.
  // Exempel: "070 Månadslön 2026-01-01 - 2026-01-31 33 724,00"
  if (art070Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of art070Group.rows) {
      const n = parseSekAfterDateRangeFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.art070 = {
        art: '070',
        rowsCount: art070Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // 4851: Ersättn sjukvård skattepl → endast beloppet efter datumintervallet.
  // Exempel: "4851 Ersättn sjukvård skattepl 2025-10-20 - 2025-10-20 275,00"
  if (art4851Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of art4851Group.rows) {
      const n = parseSekAfterDateRangeFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.art4851 = {
        art: '4851',
        rowsCount: art4851Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // 350: OB-tillägg kontant → timmar efter datumintervallet × timbelopp (SEK) efter timmar.
  // Exempel:
  // "350 OB-tillägg kontant 2025-12-25 - 2025-12-25 5,25 123,67 649,25"
  if (art350Group?.rows?.length) {
    let hoursTotal = 0;
    let sekTotalComputed = 0;
    let matched = 0;
    let sekPerHour: number | null = null;
    const sameRateEps = 0.005;

    for (const row of art350Group.rows) {
      const parsed = parse350FromRawRow(row);
      if (!parsed) continue;
      matched++;
      hoursTotal += parsed.hours;
      sekTotalComputed += parsed.hours * parsed.sekPerHour;

      if (sekPerHour == null) {
        sekPerHour = parsed.sekPerHour;
      } else if (Math.abs(sekPerHour - parsed.sekPerHour) > sameRateEps) {
        sekPerHour = null;
      }
    }

    if (matched > 0) {
      overview.art350 = {
        art: '350',
        rowsCount: art350Group.rows.length,
        hoursTotal: Math.round(hoursTotal * 100) / 100,
        sekPerHour,
        sekTotalComputed: Math.round(sekTotalComputed * 100) / 100,
      };
    }
  }

  // 70001: Semestertillägg → plocka ut dagar efter datumintervallet och multiplicera med SEK/dag.
  // Exempel: "70001 Semestertillägg 2025-12-24 - 2025-12-31 8,00 185,50 1 484,00"
  if (art70001Group?.rows?.length) {
    let daysTotal = 0;
    let sekTotalComputed = 0;
    let sekPerDay: number | null = null;
    let matched = 0;

    const sameRateEps = 0.005;

    for (const row of art70001Group.rows) {
      const parsed = parse70001SemestertillaggFromRawRow(row);
      if (!parsed) continue;

      matched++;
      daysTotal += parsed.days;

      const computed = Math.round(parsed.days * parsed.sekPerDay * 100) / 100;
      sekTotalComputed += computed;

      if (sekPerDay == null) {
        sekPerDay = parsed.sekPerDay;
      } else if (Math.abs(sekPerDay - parsed.sekPerDay) > sameRateEps) {
        sekPerDay = null;
      }
    }

    if (matched > 0) {
      overview.art70001 = {
        art: '70001',
        rowsCount: art70001Group.rows.length,
        daysTotal,
        sekPerDay,
        sekTotalComputed: Math.round(sekTotalComputed * 100) / 100,
      };
    }
  }

  // K7022: Semesterersättning direkt rörliga delar → summera beloppet efter datumintervallet.
  // Exempel: "K7022 Semesterersättning direkt rörliga delar 2025-12-21 - 2025-12-21 19,80"
  if (artK7022Group?.rows?.length) {
    let sekTotal = 0;
    let matched = 0;

    for (const row of artK7022Group.rows) {
      const n = parseSekAfterDateRangeFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matched++;
    }

    if (matched > 0) {
      overview.artK7022 = {
        art: 'K7022',
        rowsCount: artK7022Group.rows.length,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // Fackföreningsavgift (ofta ART 690/960) → plocka ut beloppet efter ordet "Fackföreningsavgift".
  // Exempel: "960 Fackföreningsavgift -490,00"
  {
    let sekTotal = 0;
    let matchedRows = 0;

    for (const g of artGroups) {
      // Keep it tight: only consider likely arts, but still accept the keyword if it appears.
      const isLikelyArt = g.art === '690' || g.art === '960';
      const rows = g.rows ?? [];

      for (const row of rows) {
        if (!row) continue;
        if (!/Fackföreningsavgift/i.test(row) && !isLikelyArt) continue;

        const n = parseFackforeningsavgiftFromRawRow(row);
        if (typeof n !== 'number' || !Number.isFinite(n)) continue;
        sekTotal += n;
        matchedRows++;
      }
    }

    if (matchedRows > 0) {
      overview.fackforeningsavgift = {
        rowsCount: matchedRows,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  // Friskvård: K5441 (varav moms) + 9190 (friskvårdsersättning)
  // Vi är intresserade av beloppet som kommer efter datumintervallet.
  if (art9190Group?.rows?.length || artK5441Group?.rows?.length) {
    let sekTotal = 0;
    let matchedRows = 0;

    const allRows = [...(artK5441Group?.rows ?? []), ...(art9190Group?.rows ?? [])];
    for (const row of allRows) {
      const n = parseSekAfterDateRangeFromRawRow(row);
      if (typeof n !== 'number' || !Number.isFinite(n)) continue;
      sekTotal += n;
      matchedRows++;
    }

    if (matchedRows > 0) {
      overview.friskvard = {
        rowsCount: matchedRows,
        sekTotal: Math.round(sekTotal * 100) / 100,
      };
    }
  }

  return overview;
}
