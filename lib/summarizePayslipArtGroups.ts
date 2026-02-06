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

export type PayslipArtOverview = {
  art315?: ArtSummary315;
  art311?: ArtSummary311;
  art301?: ArtSummary301;
  art320?: ArtSummary320;
  art302?: ArtSummary302;
  art700?: ArtSummary700;
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
  const art311Group = artGroups.find((g) => g.art === '311');
  const art301Group = artGroups.find((g) => g.art === '301');
  const art302Group = artGroups.find((g) => g.art === '302');
  const art700Group = artGroups.find((g) => g.art === '700');
  const art320Group = artGroups.find((g) => g.art === '320');
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
    const dates = new Set<string>();
    const minutesByDateISO: Record<string, number> = {};

    for (const row of art301Group.rows) {
      const parsed = parseArtRow(row);
      if (!parsed?.dateFrom || !parsed.dateTo) continue;

      const hours = parse301HoursFromRawRow(row);
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
    overview.art301 = { art: '301', totalMinutes, datesISO, monthISO, minutesByDateISO };
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

  return overview;
}
