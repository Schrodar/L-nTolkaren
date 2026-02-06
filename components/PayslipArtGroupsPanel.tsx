import * as React from 'react';
import Image from 'next/image';

import { summarizePayslipArtGroups } from '@/lib/summarizePayslipArtGroups';

const EMPTY_DATES: string[] = [];

export type PayslipArtGroups = {
  fileName?: string;
  artGroups: { art: string; rows: string[] }[];
  lines?: { y: number; text: string }[];
};

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}
function weekdayMonFirst(date: Date) {
  const d = date.getDay();
  return (d + 6) % 7;
}

function MonthCalendar({
  monthISO,
  overtimeBreakdownByDayISO,
  workDaysISO,
  art302DatesISO,
  semesterDaysISO,
  vabDaysISO,
  vabBreakdownByDayISO,
  caption,
}: {
  monthISO: string;
  overtimeBreakdownByDayISO?: Record<
    string,
    { minutes301?: number; minutes311?: number; minutes31101?: number; minutes312?: number; minutes31201?: number }
  >;
  workDaysISO?: string[];
  art302DatesISO?: string[];
  semesterDaysISO?: string[];
  vabDaysISO?: string[];
  vabBreakdownByDayISO?: Record<string, { hours?: number; sek?: number }>;
  caption?: string;
}) {
  const [y, m] = monthISO.split('-').map(Number);
  const total = daysInMonth(y, m);
  const first = new Date(y, m - 1, 1);
  const offset = weekdayMonFirst(first);

  const [hoveredISO, setHoveredISO] = React.useState<string | null>(null);
  const [selectedISO, setSelectedISO] = React.useState<string | null>(null);

  const breakdown = React.useMemo(() => overtimeBreakdownByDayISO ?? {}, [overtimeBreakdownByDayISO]);
  const workSet = React.useMemo(() => new Set(workDaysISO ?? []), [workDaysISO]);
  const art302Set = React.useMemo(() => new Set(art302DatesISO ?? []), [art302DatesISO]);
  const semesterSet = React.useMemo(() => new Set(semesterDaysISO ?? []), [semesterDaysISO]);
  const vabSet = React.useMemo(() => new Set(vabDaysISO ?? []), [vabDaysISO]);
  const vabBreakdown = React.useMemo(() => vabBreakdownByDayISO ?? {}, [vabBreakdownByDayISO]);

  const minutesForISO = React.useCallback(
    (iso: string): { total: number; minutes301: number; minutes311: number; minutes31101: number; minutes312: number; minutes31201: number } => {
      const b = breakdown[iso] ?? {};
      const minutes301 = typeof b.minutes301 === 'number' && Number.isFinite(b.minutes301) ? b.minutes301 : 0;
      const minutes311 = typeof b.minutes311 === 'number' && Number.isFinite(b.minutes311) ? b.minutes311 : 0;
      const minutes31101 = typeof b.minutes31101 === 'number' && Number.isFinite(b.minutes31101) ? b.minutes31101 : 0;
      const minutes312 = typeof b.minutes312 === 'number' && Number.isFinite(b.minutes312) ? b.minutes312 : 0;
      const minutes31201 = typeof b.minutes31201 === 'number' && Number.isFinite(b.minutes31201) ? b.minutes31201 : 0;

      // Avoid double-counting qualified comp time when 31201 exists.
      const qual = minutes31201 > 0 ? minutes31201 : minutes312;

      return { total: minutes301 + minutes311 + minutes31101 + qual, minutes301, minutes311, minutes31101, minutes312, minutes31201 };
    },
    [breakdown]
  );

  const fmtHours = React.useMemo(
    () => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }),
    []
  );

  const fmtSek = React.useMemo(
    () => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }),
    []
  );

  function minutesToLabel(minutes: number) {
    const hoursDec = minutes / 60;
    const h = Math.floor(minutes / 60);
    const min = Math.abs(minutes % 60);
    return `${fmtHours.format(hoursDec)} h (${h} h ${min} min)`;
  }

  const selectedInfo = selectedISO
    ? minutesForISO(selectedISO)
    : { total: 0, minutes301: 0, minutes311: 0, minutes31101: 0, minutes312: 0, minutes31201: 0 };

  const qualRelationNote = React.useCallback((minutes312: number, minutes31201: number): string | null => {
    const has312 = minutes312 > 0;
    const has31201 = minutes31201 > 0;

    if (!has312 && !has31201) return null;
    if (has31201 && !has312) return 'OBS: 31201 finns men ART 312 saknas för datumet.';
    if (has312 && !has31201) return 'OBS: ART 312 finns men 31201 (2×) saknas för datumet.';

    const expected = 2 * minutes312;
    const diff = Math.abs(minutes31201 - expected);
    const tol = 1; // minute tolerance after rounding
    if (diff <= tol) return 'OK: 31201 = 2×312 för datumet.';

    // Show both values in hours (decimal) for easier human verification.
    const h312 = fmtHours.format(minutes312 / 60);
    const h31201 = fmtHours.format(minutes31201 / 60);
    const hExpected = fmtHours.format(expected / 60);
    return `OBS: 31201 stämmer inte mot 2×312 (${h31201} h vs förväntat ${hExpected} h, 312=${h312} h).`;
  }, [fmtHours]);

  const selectedVab = React.useMemo(() => {
    if (!selectedISO) return null;
    const v = vabBreakdown[selectedISO];
    const hours = typeof v?.hours === 'number' && Number.isFinite(v.hours) ? v.hours : 0;
    const sek = typeof v?.sek === 'number' && Number.isFinite(v.sek) ? v.sek : 0;
    if (hours === 0 && sek === 0) return null;
    return { hours, sek };
  }, [selectedISO, vabBreakdown]);

  const isModalOpen = !!selectedISO && (selectedInfo.total > 0 || !!selectedVab);

  React.useEffect(() => {
    if (!isModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedISO(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const cells: Array<{ day?: number; iso?: string }> = [];
  for (let i = 0; i < offset; i++) cells.push({});
  for (let day = 1; day <= total; day++) {
    const iso = `${monthISO}-${String(day).padStart(2, '0')}`;
    cells.push({ day, iso });
  }
  while (cells.length % 7 !== 0) cells.push({});

  const monthLabel = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: 'long' }).format(
    new Date(y, m - 1, 1)
  );

  const overtimeCount = Object.keys(breakdown).filter((d) => d.startsWith(monthISO) && minutesForISO(d).total > 0)
    .length;
  const workCount = (workDaysISO ?? []).filter((d) => d.startsWith(monthISO)).length;
  const markedCount = new Set([
    ...Object.keys(breakdown).filter((d) => minutesForISO(d).total > 0),
    ...(workDaysISO ?? []),
    ...(art302DatesISO ?? []),
    ...(semesterDaysISO ?? []),
    ...(vabDaysISO ?? []),
  ]).size;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Kalender</div>
          <div className="mt-1 text-sm font-semibold text-gray-900 capitalize">{monthLabel}</div>
          {caption ? <div className="mt-1 text-[11px] text-gray-500">{caption}</div> : null}
        </div>
        <div className="text-xs text-gray-600">
          Markerade: <span className="font-semibold text-gray-900">{markedCount}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] text-gray-500">
        {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, idx) => (
          <div key={`${d}-${idx}`} className="text-center font-semibold">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          const minutesInfo = c.iso
            ? minutesForISO(c.iso)
            : { total: 0, minutes301: 0, minutes311: 0, minutes31101: 0, minutes312: 0, minutes31201: 0 };
          const hasMinutes = minutesInfo.total > 0;
          const isWorkDay = !!c.iso && workSet.has(c.iso);
          const hasArt302 = !!c.iso && art302Set.has(c.iso);
          const hasSemester = !!c.iso && semesterSet.has(c.iso);
          const hasVab = !!c.iso && (vabSet.has(c.iso) || !!vabBreakdown[c.iso]);
          // Spec: ändra inget annat i kalendern, förutom att om ART 302 hamnar under en grön dag (315)
          // så ska den bli röd. Vi triggar alltså inte tooltip/popup för 302 här.
          const forceRedBecause302OnWorkDay = isWorkDay && hasArt302;

          const isRedDay = hasMinutes || forceRedBecause302OnWorkDay;
          const showTicktack = hasMinutes;
          const showRedDot = hasArt302;
          const hoverTitle = c.iso ? c.iso : '';
          const isHovered = !!c.iso && hoveredISO === c.iso;
          return (
            <div
              key={idx}
              className={[
                'relative h-9 rounded-lg border text-sm flex items-center justify-center',
                c.day ? 'border-gray-200' : 'border-transparent',
                isRedDay
                  ? 'bg-red-50 border-red-200 text-gray-900 font-semibold'
                  : hasSemester
                    ? 'bg-amber-50 border-amber-200 text-amber-950 font-semibold'
                  : isWorkDay
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-white text-gray-700',
              ].join(' ')}
              title={hoverTitle}
              onMouseEnter={() => {
                if (c.iso && hasMinutes) setHoveredISO(c.iso);
              }}
              onMouseLeave={() => {
                if (c.iso && hoveredISO === c.iso) setHoveredISO(null);
              }}
              onClick={() => {
                if (c.iso && (hasMinutes || hasVab)) setSelectedISO(c.iso);
              }}
              role={c.iso && (hasMinutes || hasVab) ? 'button' : undefined}
              tabIndex={c.iso && (hasMinutes || hasVab) ? 0 : undefined}
              onKeyDown={(e) => {
                if (!c.iso || (!hasMinutes && !hasVab)) return;
                if (e.key === 'Enter' || e.key === ' ') setSelectedISO(c.iso);
              }}
            >
              {hasSemester || hasVab || showTicktack ? (
                <span
                  aria-hidden="true"
                  className="absolute right-0.5 -top-2 flex items-center gap-0.5"
                >
                  {hasSemester ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image src="/semester.png" alt="" width={20} height={20} />
                    </span>
                  ) : null}

                  {hasVab ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image src="/vab.png" alt="" width={20} height={20} />
                    </span>
                  ) : null}

                  {showTicktack ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image src="/ticktack.png" alt="" width={20} height={20} />
                    </span>
                  ) : null}
                </span>
              ) : null}

              {showRedDot ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 z-10 h-2 w-2 rounded-full bg-red-600"
                />
              ) : null}

              {isHovered && hasMinutes ? (
                <div
                  role="tooltip"
                  className={[
                    'absolute left-1/2 top-full z-10 mt-2 w-[190px] -translate-x-1/2 rounded-xl border',
                    'border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-800 shadow-lg',
                  ].join(' ')}
                >
                  <div className="text-[11px] font-semibold text-gray-900">Övertid</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">{c.iso}</div>
                  <div className="mt-1 font-semibold text-gray-900">{minutesToLabel(minutesInfo.total)}</div>
                  <div className="mt-1 text-[11px] text-gray-600">
                    301 utbetald: {minutesInfo.minutes301 ? minutesToLabel(minutesInfo.minutes301) : '–'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    311 komp: {minutesInfo.minutes311 ? minutesToLabel(minutesInfo.minutes311) : '–'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    31101 komp (1,4x): {minutesInfo.minutes31101 ? minutesToLabel(minutesInfo.minutes31101) : '–'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    312 kval komp: {minutesInfo.minutes312 ? minutesToLabel(minutesInfo.minutes312) : '–'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    31201 kval omräkning (2x): {minutesInfo.minutes31201 ? minutesToLabel(minutesInfo.minutes31201) : '–'}
                  </div>

                  {(() => {
                    const note = qualRelationNote(minutesInfo.minutes312, minutesInfo.minutes31201);
                    return note ? <div className="mt-1 text-[11px] text-amber-700">{note}</div> : null;
                  })()}
                  <div className="mt-1 text-[11px] text-gray-500">Klicka för mer info</div>
                </div>
              ) : null}

              {c.day ?? ''}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        Ticktack-ikon = övertid (ART 301 utbetald + ART 311 till komp + ART 31101/31201 omräkning). Röd prick = ART 302 (övertid, kvalificerad). Hover visar timmar, klick öppnar popup.
        <span className="ml-2">Grön dag = arbete (ART 315).</span>
        <span className="ml-2">Gul markering + ikon = semester (ART 700).</span>
        <span className="ml-2">Ikon = VAB (ART 810/81001).</span>
      </div>

      <div className="mt-1 text-[11px] text-gray-500">
        Denna månad: övertid <span className="font-semibold text-gray-700">{overtimeCount}</span>, arbete{' '}
        <span className="font-semibold text-gray-700">{workCount}</span>, totalt markerade{' '}
        <span className="font-semibold text-gray-700">{markedCount}</span>.
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedISO(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Övertid detaljer"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Övertid</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{selectedISO}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedISO(null)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Stäng
              </button>
            </div>

            {selectedInfo.total > 0 ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-xs font-semibold text-gray-700">Övertid</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
                  {minutesToLabel(selectedInfo.total)}
                </div>
                <div className="mt-2 text-xs text-gray-700">
                  <div>ART 301 (utbetald): {selectedInfo.minutes301 ? minutesToLabel(selectedInfo.minutes301) : '–'}</div>
                  <div>ART 311 (till komp): {selectedInfo.minutes311 ? minutesToLabel(selectedInfo.minutes311) : '–'}</div>
                  <div>ART 31101 (till komp, 1,4x): {selectedInfo.minutes31101 ? minutesToLabel(selectedInfo.minutes31101) : '–'}</div>
                  <div>ART 312 (kval till komp): {selectedInfo.minutes312 ? minutesToLabel(selectedInfo.minutes312) : '–'}</div>
                  <div>ART 31201 (kval omräkning, 2x): {selectedInfo.minutes31201 ? minutesToLabel(selectedInfo.minutes31201) : '–'}</div>

                  {(() => {
                    const note = qualRelationNote(selectedInfo.minutes312, selectedInfo.minutes31201);
                    return note ? <div className="mt-2 text-amber-700">{note}</div> : null;
                  })()}
                </div>
              </div>
            ) : null}

            {selectedVab ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-700">VAB (81001)</div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <div className="text-gray-600">Tid</div>
                  <div className="tabular-nums font-semibold text-gray-900">{fmtHours.format(selectedVab.hours)} h</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <div className="text-gray-600">Summa</div>
                  <div className="tabular-nums font-semibold text-gray-900">{fmtSek.format(selectedVab.sek)}</div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 text-[11px] text-gray-500">Tips: Tryck ESC för att stänga.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function countRows(groups: PayslipArtGroups['artGroups']) {
  return groups.reduce((sum, g) => sum + (g.rows?.length ?? 0), 0);
}

export function PayslipArtGroupsPanel({ fileName, artGroups, lines }: PayslipArtGroups) {
  const totalRows = React.useMemo(() => countRows(artGroups), [artGroups]);

  const overview = React.useMemo(() => summarizePayslipArtGroups(artGroups), [artGroups]);

  const sorted = React.useMemo(() => {
    return [...artGroups].sort((a, b) => (b.rows?.length ?? 0) - (a.rows?.length ?? 0));
  }, [artGroups]);

  const artsCoveredInOverview = React.useMemo(() => {
    const set = new Set<string>();

    if (overview.art315) set.add('315');
    if (overview.art700) set.add('700');

    if (overview.art311) set.add('311');
    if (overview.art31101) set.add('31101');
    if (overview.art312) set.add('312');
    if (overview.art31201) set.add('31201');
    if (overview.art301) set.add('301');
    if (overview.art320) set.add('320');

    if (overview.art2101) set.add('2101');
    if (overview.art9001) set.add('9001');
    if (overview.art9002) set.add('9002');
    if (overview.art0641) set.add('0641');
    if (overview.art0644) set.add('0644');
    if (overview.art070) set.add('070');
    if (overview.art70001) set.add('70001');
    if (overview.artK7022) set.add('K7022');

    // VAB-card in overview effectively covers both 810 and 81001.
    if (overview.art810 || overview.art81001) {
      set.add('810');
      set.add('81001');
    }

    // Summary cards that aggregate multiple arts.
    if (overview.fackforeningsavgift) {
      set.add('690');
      set.add('960');
    }
    if (overview.friskvard) {
      set.add('9190');
      set.add('K5441');
    }

    return set;
  }, [overview]);

  const byArtNotInOverview = React.useMemo(() => {
    return (overview.byArt ?? []).filter((r) => !artsCoveredInOverview.has(r.art));
  }, [overview.byArt, artsCoveredInOverview]);

  const sortedNotInOverview = React.useMemo(() => {
    return (sorted ?? []).filter((g) => !artsCoveredInOverview.has(g.art));
  }, [sorted, artsCoveredInOverview]);

  const formatSek = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(n);
  }, []);

  const formatInt = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n);
  }, []);

  const formatHours = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n);
  }, []);

  const art315 = overview.art315;
  const art315Hours = art315 ? Math.floor(art315.totalMinutes / 60) : 0;
  const art315Minutes = art315 ? Math.abs(art315.totalMinutes % 60) : 0;

  const art311 = overview.art311;
  const art311Hours = art311 ? Math.floor(art311.totalMinutes / 60) : 0;
  const art311Minutes = art311 ? Math.abs(art311.totalMinutes % 60) : 0;

  const art31101 = overview.art31101;
  const art31101Hours = art31101 ? Math.floor(art31101.totalMinutes / 60) : 0;
  const art31101Minutes = art31101 ? Math.abs(art31101.totalMinutes % 60) : 0;

  const art31201 = overview.art31201;
  const art31201Hours = art31201 ? Math.floor(art31201.totalMinutes / 60) : 0;
  const art31201Minutes = art31201 ? Math.abs(art31201.totalMinutes % 60) : 0;

  const art312 = overview.art312;
  const art312Hours = art312 ? Math.floor(art312.totalMinutes / 60) : 0;
  const art312Minutes = art312 ? Math.abs(art312.totalMinutes % 60) : 0;

  const art301 = overview.art301;
  const art301Hours = art301 ? Math.floor(art301.totalMinutes / 60) : 0;
  const art301Minutes = art301 ? Math.abs(art301.totalMinutes % 60) : 0;

  const art700 = overview.art700;
  const art700DatesISO = art700?.datesISO ?? EMPTY_DATES;
  const art700DaysCount = art700DatesISO.length;
  const art700GeneratedHours = art700DaysCount * 5;

  const art700Periods = React.useMemo(() => {
    const dates = art700DatesISO;
    if (!dates.length) return [] as Array<{ fromISO: string; toISO: string }>;

    const utcMs = (iso: string): number | null => {
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
      return Date.UTC(y, mo - 1, d);
    };

    const oneDay = 24 * 60 * 60 * 1000;
    const out: Array<{ fromISO: string; toISO: string }> = [];

    let fromISO = dates[0];
    let prevISO = dates[0];
    let prevMs = utcMs(prevISO);

    for (let i = 1; i < dates.length; i++) {
      const curISO = dates[i];
      const curMs = utcMs(curISO);
      const isContiguous =
        typeof prevMs === 'number' && typeof curMs === 'number' ? curMs - prevMs === oneDay : false;

      if (!isContiguous) {
        out.push({ fromISO, toISO: prevISO });
        fromISO = curISO;
      }

      prevISO = curISO;
      prevMs = curMs;
    }

    out.push({ fromISO, toISO: prevISO });
    return out;
  }, [art700DatesISO]);

  const art320 = overview.art320;

  const art9001 = overview.art9001;
  const art9002 = overview.art9002;
  const art0641 = overview.art0641;
  const art0644 = overview.art0644;
  const art070 = overview.art070;
  const art70001 = overview.art70001;
  const artK7022 = overview.artK7022;
  const fackforeningsavgift = overview.fackforeningsavgift;
  const friskvard = overview.friskvard;

  const art81001 = overview.art81001;

  const vabBreakdownByDayISO = React.useMemo(() => {
    const out: Record<string, { hours?: number; sek?: number }> = {};

    const hoursByDateISO = art81001?.hoursByDateISO ?? overview.art810?.hoursByDateISO;
    if (hoursByDateISO) {
      for (const [iso, hours] of Object.entries(hoursByDateISO)) {
        if (typeof hours !== 'number' || !Number.isFinite(hours) || hours === 0) continue;
        out[iso] = { ...(out[iso] ?? {}), hours: (out[iso]?.hours ?? 0) + hours };
      }
    }

    if (art81001?.sekByDateISO) {
      for (const [iso, sek] of Object.entries(art81001.sekByDateISO)) {
        if (typeof sek !== 'number' || !Number.isFinite(sek) || sek === 0) continue;
        out[iso] = { ...(out[iso] ?? {}), sek: (out[iso]?.sek ?? 0) + sek };
      }
    }

    return out;
  }, [art81001, overview.art810]);

  const vabDaysISO = React.useMemo(() => {
    const d1 = overview.art810?.datesISO ?? EMPTY_DATES;
    const d2 = overview.art81001?.datesISO ?? EMPTY_DATES;
    const set = new Set<string>([...d1, ...d2]);
    return Array.from(set).sort();
  }, [overview.art810, overview.art81001]);

  const overtimeBreakdownByDayISO = React.useMemo(() => {
    const out: Record<string, { minutes301?: number; minutes311?: number; minutes31101?: number; minutes312?: number; minutes31201?: number }> = {};
    if (art301?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art301.minutesByDateISO)) {
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) continue;
        out[iso] = { ...(out[iso] ?? {}), minutes301: (out[iso]?.minutes301 ?? 0) + minutes };
      }
    }

    // Om 31101/31201 finns för ett datum så representerar de omräknad komptid.
    // Då undviker vi dubbelräkning genom att inte lägga till 311 för samma datum.
    const hasRecalc = new Set<string>();
    if (art31101?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art31101.minutesByDateISO)) {
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) continue;
        hasRecalc.add(iso);
        out[iso] = { ...(out[iso] ?? {}), minutes31101: (out[iso]?.minutes31101 ?? 0) + minutes };
      }
    }
    if (art31201?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art31201.minutesByDateISO)) {
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) continue;
        hasRecalc.add(iso);
        out[iso] = { ...(out[iso] ?? {}), minutes31201: (out[iso]?.minutes31201 ?? 0) + minutes };
      }
    }

    // 312 (kval till komp): include even if 31201 exists so we can validate relation.
    if (art312?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art312.minutesByDateISO)) {
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) continue;
        out[iso] = { ...(out[iso] ?? {}), minutes312: (out[iso]?.minutes312 ?? 0) + minutes };
      }
    }

    if (art311?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art311.minutesByDateISO)) {
        if (hasRecalc.has(iso)) continue;
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) continue;
        out[iso] = { ...(out[iso] ?? {}), minutes311: (out[iso]?.minutes311 ?? 0) + minutes };
      }
    }

    return out;
  }, [art301, art311, art31101, art31201, art312]);

  const calendarMonthISO =
    art301?.monthISO ??
    art31101?.monthISO ??
    art31201?.monthISO ??
    art312?.monthISO ??
    art311?.monthISO ??
    overview.art81001?.monthISO ??
    overview.art810?.monthISO ??
    art315?.monthISO ??
    overview.art700?.monthISO ??
    null;
  const hasAnyOvertime = !!Object.keys(overtimeBreakdownByDayISO).length;
  const art302DatesISO = overview.art302?.datesISO ?? [];
  const semesterDaysISO = overview.art700?.datesISO ?? EMPTY_DATES;

  return (
    <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <p className="mt-1 text-sm text-gray-600">
          {fileName ? fileName : '–'}
          <span className="text-gray-400"> • </span>
          <span>
            {artGroups.length} grupper, {totalRows} rader
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
        <div>
          {calendarMonthISO ? (
            <MonthCalendar
              monthISO={calendarMonthISO}
              overtimeBreakdownByDayISO={overtimeBreakdownByDayISO}
              workDaysISO={art315?.datesISO ?? []}
              art302DatesISO={art302DatesISO}
              semesterDaysISO={semesterDaysISO}
              vabDaysISO={vabDaysISO}
              vabBreakdownByDayISO={vabBreakdownByDayISO}
              caption={
                hasAnyOvertime
                  ? 'Markerar övertid: ART 301 (utbetald) + ART 311 (till komp)'
                  : 'Inga övertidsrader (ART 301/311) hittades i denna PDF.'
              }
            />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              Kunde inte avgöra månad för kalender (inga datum i ART 311/315).
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Översikt</div>

          <div className="mt-3 space-y-2 text-sm">
           

            <div className="pt-3" />

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Arbetstid (315)</div>
              {art315 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">ART 315</div>
                  <div className="tabular-nums font-semibold text-gray-900">
                    {formatInt(art315Hours)} h {formatInt(art315Minutes)} min
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 315-rader.</div>
              )}
              {art315?.datesISO.length ? (
                <div className="mt-1 text-xs text-gray-500">Datum markerade: {art315.datesISO.length}</div>
              ) : null}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Semester (700)</div>
              {art700 ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Semesterdagar</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatInt(art700DaysCount)}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Semestertid</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatInt(art700GeneratedHours)} h</div>
                  </div>

                  {art700Periods.length ? (
                    <div className="mt-1 text-xs text-gray-500">
                      {art700Periods.length === 1 ? 'Period:' : 'Perioder:'}{' '}
                      {art700Periods.map((p) => `${p.fromISO} – ${p.toISO}`).join(', ')}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 700-rader.</div>
              )}
              <div className="mt-1 text-xs text-gray-500">Varje semesterdag räknas som 5 timmars arbete.</div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Övertid till komp (311)</div>
              {art311 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">ART 311</div>
                  <div className="tabular-nums font-semibold text-gray-900">
                    {formatInt(art311Hours)} h {formatInt(art311Minutes)} min
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 311-rader.</div>
              )}
              {art311?.datesISO.length ? (
                <div className="mt-1 text-xs text-gray-500">Datum markerade: {art311.datesISO.length}</div>
              ) : null}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Övertid, omräkning (31101 / 31201)</div>
              {art31101 || art31201 ? (
                <>
                  {art31101 ? (
                    <div className="mt-1 flex items-center justify-between">
                      <div className="text-gray-600">ART 31101</div>
                      <div className="tabular-nums font-semibold text-gray-900">
                        {formatInt(art31101Hours)} h {formatInt(art31101Minutes)} min
                      </div>
                    </div>
                  ) : null}
                  {art31201 ? (
                    <div className="mt-1 flex items-center justify-between">
                      <div className="text-gray-600">ART 31201</div>
                      <div className="tabular-nums font-semibold text-gray-900">
                        {formatInt(art31201Hours)} h {formatInt(art31201Minutes)} min
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 31101/31201-rader.</div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                31101 = okvalificerad omräkning (1,4×). 31201 = helgdag/helg omräkning (2×).
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Övertid (301, utbetald)</div>
              {art301 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">ART 301</div>
                  <div className="tabular-nums font-semibold text-gray-900">
                    {formatInt(art301Hours)} h {formatInt(art301Minutes)} min
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 301-rader.</div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                301 = övertid som betalas ut. 311 = övertid som sparas till kompsaldo.
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Komp → pengar (320)</div>
              {art320 ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Timmar</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatHours(art320.hoursTotal)} h</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Timbelopp</div>
                    <div className="tabular-nums font-semibold text-gray-900">
                      {typeof art320.sekPerHour === 'number' ? formatSek(art320.sekPerHour) : 'Varierar'}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Beräknat utbetalt</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatSek(art320.sekTotalComputed)}</div>
                  </div>
                  {typeof art320.sekTotalFromRow === 'number' ? (
                    <div className="mt-1 text-[11px] text-gray-500">
                      Enligt raden: {formatSek(art320.sekTotalFromRow)}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 320-rader.</div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                320 = omvandling av komptid till pengar: timmar × timbelopp.
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Skatt (9001)</div>
              {art9001 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Tabellskatt</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(art9001.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 9001-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Skatt (9002)</div>
              {art9002 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Engångsskatt</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(art9002.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 9002-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Däckmanstillägg (0641)</div>
              {art0641 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Summa</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(art0641.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 0641-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Rederitillägg (0644)</div>
              {art0644 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Summa</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(art0644.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 0644-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Månadslön (070)</div>
              {art070 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Summa</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(art070.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 070-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Semestertillägg (70001)</div>
              {art70001 ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Dagar</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatHours(art70001.daysTotal)}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Summa</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatSek(art70001.sekTotalComputed)}</div>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 70001-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Semesterersättning direkt rörliga (K7022)</div>
              {artK7022 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Summa</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(artK7022.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga K7022-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Fackföreningsavgift</div>
              {fackforeningsavgift ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Avgift</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(fackforeningsavgift.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade ingen fackföreningsavgift.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Friskvård (9190 + K5441)</div>
              {friskvard ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">Summa</div>
                  <div className="tabular-nums font-semibold text-gray-900">{formatSek(friskvard.sekTotal)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade ingen friskvård.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Maskinskötseltillägg (2101)</div>
              {overview.art2101 ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Antal dagar</div>
                    <div className="tabular-nums font-semibold text-gray-900">{overview.art2101.rowsCount}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Summerat belopp</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatSek(overview.art2101.sekTotal)}</div>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 2101-rader.</div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Vård av barn (81001)</div>
              {art81001 ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Timmar</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatHours(art81001.hoursTotal)} h</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Summa</div>
                    <div className="tabular-nums font-semibold text-gray-900">
                      {typeof art81001.sekTotalFromRow === 'number' ? formatSek(art81001.sekTotalFromRow) : formatSek(art81001.sekTotalComputed)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 81001-rader.</div>
              )}
              <div className="mt-1 text-xs text-gray-500">810/81001 = VAB. Procenten efter “Tim” ignoreras.</div>
            </div>

            <div className="pt-2 text-[11px] text-gray-500">
              Matchar rader som börjar med artnummer:{' '}
              <span className="font-mono">
                /^(\d{'{'}2,5{'}'}|K\d{'{'}4{'}'})\s/
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          

          {typeof lines?.length === 'number' ? (
            <div className="mt-3 text-xs text-gray-600">
              Text-rader (debug): <span className="tabular-nums font-semibold text-gray-900">{lines.length}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Grupper</h3>
          <div className="text-xs text-gray-600">
            Sorterat: <span className="font-semibold text-gray-900">flest rader först</span>
          </div>
        </div>

        {byArtNotInOverview.length ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
              <div className="text-xs font-semibold text-gray-600">Art</div>
              <div className="text-xs font-semibold text-gray-600">Rubrik (från första raden)</div>
              <div className="text-right text-xs font-semibold text-gray-600">Rader</div>
            </div>
            <div className="max-h-[260px] overflow-auto">
              {byArtNotInOverview.map((r) => (
                <div key={r.art} className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="font-mono text-sm text-gray-800">{r.art}</div>
                  <div className="text-sm text-gray-900">
                    <div className="font-medium">{r.description}</div>
                  </div>
                  <div className="tabular-nums text-right text-sm font-semibold text-gray-900">{r.rowsCount}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {sortedNotInOverview.length ? (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {sortedNotInOverview.map((g) => (
              <div key={g.art} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <div className="font-mono text-sm font-semibold text-gray-900">{g.art}</div>
                  <div className="text-xs text-gray-600">
                    <span className="tabular-nums font-semibold text-gray-900">{g.rows.length}</span> rader
                  </div>
                </div>

                <div className="max-h-[360px] overflow-auto px-4 py-3">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-gray-800">
                    {g.rows.join('\n')}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            Inga övriga ART-grupper att visa (allt som hittades visas redan i Översikt).
          </div>
        )}

        {lines?.length ? (
          <details className="mt-5 rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
              Visa text-rader (debug)
            </summary>
            <div className="border-t border-gray-100 px-4 py-3">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">
                {lines.map((l) => `${l.y.toFixed(1)}\t${l.text}`).join('\n')}
              </pre>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
