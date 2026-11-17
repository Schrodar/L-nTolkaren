import * as React from 'react';
import Image from 'next/image';
import { motion, useTime, useTransform } from 'framer-motion';

import { summarizePayslipArtGroups } from '@/lib/summarizePayslipArtGroups';
import type {
  PayslipSection,
  SpecTotals,
} from '@/lib/parsePayslipArtGroups';

const EMPTY_DATES: string[] = [];

export type PayslipArtGroups = {
  fileName?: string;
  artGroups: { art: string; rows: string[] }[];
  lines?: { y: number; text: string }[];
  /** Art-raderna per anställning — en spec kan innehålla flera */
  sections?: PayslipSection[];
  /** Specens egen "Att utbetala" att stämma av mot */
  totals?: SpecTotals;
};

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}
function weekdayMonFirst(date: Date) {
  const d = date.getDay();
  return (d + 6) % 7;
}

/**
 * Långdagsgräns enligt §5.2 i skärgårdsavtalet: "arbetstid som överstiger
 * 10,5 timmar per dygn ersätts med 0,4 timmar utöver ordinarie arbetstid
 * (långdagsersättning/-tillägg)". Tillägget bokförs som art K315 på specen.
 */
const LANGDAG_GRANS_H = 10.5;
const LANGDAG_FAKTOR = 0.4;

function MonthCalendar({
  monthISO,
  overtimeBreakdownByDayISO,
  workDaysISO,
  workHoursByDayISO,
  plusHoursByDayISO,
  art302DatesISO,
  art302BreakdownByDayISO,
  sicknessDaysISO,
  semesterDaysISO,
  vabDaysISO,
  vabBreakdownByDayISO,
  caption,
}: {
  monthISO: string;
  overtimeBreakdownByDayISO?: Record<
    string,
    {
      minutes301?: number;
      minutes311?: number;
      minutes31101?: number;
      minutes312?: number;
      minutes31201?: number;
    }
  >;
  workDaysISO?: string[];
  workHoursByDayISO?: Record<string, number>;
  plusHoursByDayISO?: Record<string, number>;
  art302DatesISO?: string[];
  art302BreakdownByDayISO?: Record<string, { hours?: number; sek?: number }>;
  sicknessDaysISO?: string[];
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

  const breakdown = React.useMemo(
    () => overtimeBreakdownByDayISO ?? {},
    [overtimeBreakdownByDayISO],
  );
  // Plustid (art483) — tid över årsarbetstidstaket. En dag som i sin helhet
  // ligger över taket saknar art315-rad helt, men är förstås en arbetsdag
  // ändå och ska markeras som en vanlig dag i kalendern.
  const plusHoursByDay = React.useMemo(
    () => plusHoursByDayISO ?? {},
    [plusHoursByDayISO],
  );
  const workSet = React.useMemo(
    () => new Set([...(workDaysISO ?? []), ...Object.keys(plusHoursByDay)]),
    [workDaysISO, plusHoursByDay],
  );
  const art302Set = React.useMemo(
    () => new Set(art302DatesISO ?? []),
    [art302DatesISO],
  );
  const art302Breakdown = React.useMemo(
    () => art302BreakdownByDayISO ?? {},
    [art302BreakdownByDayISO],
  );
  const workHoursByDay = React.useMemo(
    () => workHoursByDayISO ?? {},
    [workHoursByDayISO],
  );
  const sicknessSet = React.useMemo(
    () => new Set(sicknessDaysISO ?? []),
    [sicknessDaysISO],
  );
  const semesterSet = React.useMemo(
    () => new Set(semesterDaysISO ?? []),
    [semesterDaysISO],
  );
  const vabSet = React.useMemo(() => new Set(vabDaysISO ?? []), [vabDaysISO]);
  const vabBreakdown = React.useMemo(
    () => vabBreakdownByDayISO ?? {},
    [vabBreakdownByDayISO],
  );

  const minutesForISO = React.useCallback(
    (
      iso: string,
    ): {
      total: number;
      minutes301: number;
      minutes311: number;
      minutes31101: number;
      minutes312: number;
      minutes31201: number;
    } => {
      const b = breakdown[iso] ?? {};
      const minutes301 =
        typeof b.minutes301 === 'number' && Number.isFinite(b.minutes301)
          ? b.minutes301
          : 0;
      const minutes311 =
        typeof b.minutes311 === 'number' && Number.isFinite(b.minutes311)
          ? b.minutes311
          : 0;
      const minutes31101 =
        typeof b.minutes31101 === 'number' && Number.isFinite(b.minutes31101)
          ? b.minutes31101
          : 0;
      const minutes312 =
        typeof b.minutes312 === 'number' && Number.isFinite(b.minutes312)
          ? b.minutes312
          : 0;
      const minutes31201 =
        typeof b.minutes31201 === 'number' && Number.isFinite(b.minutes31201)
          ? b.minutes31201
          : 0;

      // Avoid double-counting qualified comp time when 31201 exists.
      const qual = minutes31201 > 0 ? minutes31201 : minutes312;

      return {
        total: minutes301 + minutes311 + minutes31101 + qual,
        minutes301,
        minutes311,
        minutes31101,
        minutes312,
        minutes31201,
      };
    },
    [breakdown],
  );

  const fmtHours = React.useMemo(
    () => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }),
    [],
  );

  const fmtSek = React.useMemo(
    () =>
      new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }),
    [],
  );

  // Express (ART 315) modal animation: continuous horizontal figure-eight (∞) + roll.
  // Use time-based motion values to avoid any perceived “stops” at keyframes.
  const expressTime = useTime();
  const expressPhase = useTransform(expressTime, (ms) => {
    const loopSeconds = 5.2;
    const t = (ms / 1000) % loopSeconds;
    return (t / loopSeconds) * (2 * Math.PI);
  });
  const expressX = useTransform(expressPhase, (p) => 12 * Math.sin(p));
  const expressY = useTransform(expressPhase, (p) => 5 * Math.sin(2 * p));
  const expressRotate = useTransform(expressPhase, (p) => -8 * Math.sin(p));

  function minutesToLabel(minutes: number) {
    const hoursDec = minutes / 60;
    const h = Math.floor(minutes / 60);
    const min = Math.abs(minutes % 60);
    return `${fmtHours.format(hoursDec)} h (${h} h ${min} min)`;
  }

  const selectedInfo = selectedISO
    ? minutesForISO(selectedISO)
    : {
        total: 0,
        minutes301: 0,
        minutes311: 0,
        minutes31101: 0,
        minutes312: 0,
        minutes31201: 0,
      };

  const qualRelationNote = React.useCallback(
    (minutes312: number, minutes31201: number): string | null => {
      const has312 = minutes312 > 0;
      const has31201 = minutes31201 > 0;

      if (!has312 && !has31201) return null;
      if (has31201 && !has312)
        return 'OBS: 31201 finns men ART 312 saknas för datumet.';
      if (has312 && !has31201)
        return 'OBS: ART 312 finns men 31201 (2×) saknas för datumet.';

      const expected = 2 * minutes312;
      const diff = Math.abs(minutes31201 - expected);
      const tol = 1; // minute tolerance after rounding
      if (diff <= tol) return 'OK: 31201 = 2×312 för datumet.';

      // Show both values in hours (decimal) for easier human verification.
      const h312 = fmtHours.format(minutes312 / 60);
      const h31201 = fmtHours.format(minutes31201 / 60);
      const hExpected = fmtHours.format(expected / 60);
      return `OBS: 31201 stämmer inte mot 2×312 (${h31201} h vs förväntat ${hExpected} h, 312=${h312} h).`;
    },
    [fmtHours],
  );

  const selectedVab = React.useMemo(() => {
    if (!selectedISO) return null;
    const v = vabBreakdown[selectedISO];
    const hours =
      typeof v?.hours === 'number' && Number.isFinite(v.hours) ? v.hours : 0;
    const sek =
      typeof v?.sek === 'number' && Number.isFinite(v.sek) ? v.sek : 0;
    if (hours === 0 && sek === 0) return null;
    return { hours, sek };
  }, [selectedISO, vabBreakdown]);

  const selectedHasVabDay = React.useMemo(() => {
    return (
      !!selectedISO && (vabSet.has(selectedISO) || !!vabBreakdown[selectedISO])
    );
  }, [selectedISO, vabSet, vabBreakdown]);

  const selectedPlusHours = React.useMemo(() => {
    if (!selectedISO) return 0;
    const hours = plusHoursByDay[selectedISO];
    return typeof hours === 'number' && Number.isFinite(hours) ? hours : 0;
  }, [selectedISO, plusHoursByDay]);

  /** Verklig arbetstid för dagen = nominell tid (315) + plustid (483). */
  const selectedWorkHours = React.useMemo(() => {
    const hours = selectedISO ? workHoursByDay[selectedISO] : undefined;
    const nominell =
      typeof hours === 'number' && Number.isFinite(hours) ? hours : 0;
    return nominell + selectedPlusHours;
  }, [selectedISO, workHoursByDay, selectedPlusHours]);

  const selectedArt302 = React.useMemo(() => {
    if (!selectedISO) return null;
    const v = art302Breakdown[selectedISO];
    const hours =
      typeof v?.hours === 'number' && Number.isFinite(v.hours) ? v.hours : 0;
    const sek =
      typeof v?.sek === 'number' && Number.isFinite(v.sek) ? v.sek : 0;
    if (hours === 0 && sek === 0) return null;
    return { hours, sek };
  }, [selectedISO, art302Breakdown]);

  const selectedHasSemester = React.useMemo(() => {
    return !!selectedISO && semesterSet.has(selectedISO);
  }, [selectedISO, semesterSet]);

  const selectedHasWorkDay = React.useMemo(() => {
    return !!selectedISO && workSet.has(selectedISO);
  }, [selectedISO, workSet]);

  const selectedHasSickness = React.useMemo(() => {
    return !!selectedISO && sicknessSet.has(selectedISO);
  }, [selectedISO, sicknessSet]);

  const selectedShowExpress = React.useMemo(() => {
    return (
      !!selectedISO &&
      selectedHasWorkDay &&
      !selectedHasSemester &&
      !selectedHasSickness &&
      !selectedHasVabDay
    );
  }, [
    selectedISO,
    selectedHasWorkDay,
    selectedHasSemester,
    selectedHasSickness,
    selectedHasVabDay,
  ]);

  const isModalOpen =
    !!selectedISO &&
    (selectedInfo.total > 0 ||
      !!selectedArt302 ||
      selectedHasVabDay ||
      selectedHasSemester ||
      selectedHasSickness ||
      selectedHasWorkDay);

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

  const monthLabel = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, 1));

  const overtimeCount = Object.keys(breakdown).filter(
    (d) => d.startsWith(monthISO) && minutesForISO(d).total > 0,
  ).length;
  const workCount = Array.from(workSet).filter((d) =>
    d.startsWith(monthISO),
  ).length;
  const markedCount = new Set([
    ...Object.keys(breakdown).filter((d) => minutesForISO(d).total > 0),
    ...workSet,
    ...(art302DatesISO ?? []),
    ...(sicknessDaysISO ?? []),
    ...(semesterDaysISO ?? []),
    ...(vabDaysISO ?? []),
  ]).size;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Kalender
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-900 capitalize">
            {monthLabel}
          </div>
          {caption ? (
            <div className="mt-1 text-[11px] text-gray-500">{caption}</div>
          ) : null}
        </div>
        <div className="text-xs text-gray-600">
          Markerade:{' '}
          <span className="font-semibold text-gray-900">{markedCount}</span>
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
            : {
                total: 0,
                minutes301: 0,
                minutes311: 0,
                minutes31101: 0,
                minutes312: 0,
                minutes31201: 0,
              };
          const hasMinutes = minutesInfo.total > 0;
          const isWorkDay = !!c.iso && workSet.has(c.iso);
          const hasArt302 =
            !!c.iso && (art302Set.has(c.iso) || !!art302Breakdown[c.iso]);
          const hasSickness = !!c.iso && sicknessSet.has(c.iso);
          const hasSemester = !!c.iso && semesterSet.has(c.iso);
          const hasVab =
            !!c.iso && (vabSet.has(c.iso) || !!vabBreakdown[c.iso]);

          const isClickable =
            !!c.iso &&
            (hasMinutes ||
              hasArt302 ||
              hasSickness ||
              hasVab ||
              hasSemester ||
              isWorkDay);

          const isRedDay = hasMinutes || hasArt302;
          const showTicktack = hasMinutes || hasArt302;
          const showExpress =
            isWorkDay && !hasSemester && !hasVab && !hasSickness;
          const hoverTitle = c.iso ? c.iso : '';
          const isHovered = !!c.iso && hoveredISO === c.iso;
          return (
            <div
              key={idx}
              className={[
                'relative h-9 rounded-lg border text-sm flex items-center justify-center',
                c.day ? 'border-gray-200' : 'border-transparent',
                isClickable ? 'cursor-pointer' : 'cursor-default',
                hasSickness
                  ? 'bg-emerald-900 border-emerald-950 text-white font-semibold'
                  : isRedDay
                    ? 'bg-red-50 border-red-200 text-gray-900 font-semibold'
                    : hasSemester
                      ? 'bg-amber-50 border-amber-200 text-amber-950 font-semibold'
                      : isWorkDay
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-semibold'
                        : 'bg-white text-gray-700',
              ].join(' ')}
              title={hoverTitle}
              onMouseEnter={() => {
                if (c.iso && (hasMinutes || hasArt302)) setHoveredISO(c.iso);
              }}
              onMouseLeave={() => {
                if (c.iso && hoveredISO === c.iso) setHoveredISO(null);
              }}
              onClick={() => {
                if (c.iso && isClickable) setSelectedISO(c.iso);
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (!c.iso || !isClickable) return;
                if (e.key === 'Enter' || e.key === ' ') setSelectedISO(c.iso);
              }}
            >
              {hasSemester ||
              hasVab ||
              showTicktack ||
              hasSickness ||
              showExpress ? (
                <span
                  aria-hidden="true"
                  className="absolute right-0.5 -top-2 flex items-center gap-0.5"
                >
                  {hasSemester ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image
                        src="/semester.png"
                        alt=""
                        width={20}
                        height={20}
                      />
                    </span>
                  ) : null}

                  {hasVab ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image src="/vab.png" alt="" width={20} height={20} />
                    </span>
                  ) : null}

                  {hasSickness ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image src="/temp.png" alt="" width={20} height={20} />
                    </span>
                  ) : null}

                  {showExpress ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image src="/express.png" alt="" width={20} height={20} />
                    </span>
                  ) : null}

                  {showTicktack ? (
                    <span className="h-5 w-5 shrink-0">
                      <Image
                        src="/ticktack.png"
                        alt=""
                        width={20}
                        height={20}
                      />
                    </span>
                  ) : null}
                </span>
              ) : null}

              {isHovered && (hasMinutes || hasArt302) ? (
                <div
                  role="tooltip"
                  className={[
                    'absolute left-1/2 top-full z-10 mt-2 w-[190px] -translate-x-1/2 rounded-xl border',
                    'border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-800 shadow-lg',
                  ].join(' ')}
                >
                  <div className="text-[11px] font-semibold text-gray-900">
                    Övertid
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    {c.iso}
                  </div>

                  {hasMinutes ? (
                    <>
                      <div className="mt-1 font-semibold text-gray-900">
                        {minutesToLabel(minutesInfo.total)}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600">
                        301 utbetald:{' '}
                        {minutesInfo.minutes301
                          ? minutesToLabel(minutesInfo.minutes301)
                          : '–'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        311 komp:{' '}
                        {minutesInfo.minutes311
                          ? minutesToLabel(minutesInfo.minutes311)
                          : '–'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        31101 komp (1,4x):{' '}
                        {minutesInfo.minutes31101
                          ? minutesToLabel(minutesInfo.minutes31101)
                          : '–'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        312 kval komp:{' '}
                        {minutesInfo.minutes312
                          ? minutesToLabel(minutesInfo.minutes312)
                          : '–'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        31201 kval omräkning (2x):{' '}
                        {minutesInfo.minutes31201
                          ? minutesToLabel(minutesInfo.minutes31201)
                          : '–'}
                      </div>

                      {(() => {
                        const note = qualRelationNote(
                          minutesInfo.minutes312,
                          minutesInfo.minutes31201,
                        );
                        return note ? (
                          <div className="mt-1 text-[11px] text-amber-700">
                            {note}
                          </div>
                        ) : null;
                      })()}
                    </>
                  ) : null}

                  {hasArt302 ? (
                    <>
                      <div
                        className={
                          hasMinutes
                            ? 'mt-2 text-[11px] font-semibold text-gray-900'
                            : 'mt-1 text-[11px] font-semibold text-gray-900'
                        }
                      >
                        302 kvalificerad
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        Timmar:{' '}
                        {fmtHours.format(art302Breakdown[c.iso!]?.hours ?? 0)} h
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600">
                        Summa:{' '}
                        {fmtSek.format(art302Breakdown[c.iso!]?.sek ?? 0)}
                      </div>
                    </>
                  ) : null}

                  <div className="mt-1 text-[11px] text-gray-500">
                    Klicka för mer info
                  </div>
                </div>
              ) : null}

              {c.day ?? ''}
            </div>
          );
        })}
      </div>

      {/* Ikonerna har egna tooltips — legenden behöver inte stavas ut i löptext. */}
      <div className="mt-3 text-[11px] text-gray-500">
        {workCount} arbetsdagar
        {overtimeCount > 0 ? `, ${overtimeCount} med övertid` : ''}. Klicka på
        en dag för detaljer.
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
            aria-label="Dagdetaljer"
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {selectedInfo.total > 0 || selectedArt302
                    ? 'Övertid'
                    : selectedHasWorkDay &&
                        selectedHasVabDay &&
                        selectedHasSemester &&
                        selectedHasSickness
                      ? 'Arbete + VAB + semester + sjukdom'
                      : selectedHasWorkDay &&
                          selectedHasVabDay &&
                          selectedHasSemester
                        ? 'Arbete + VAB + semester'
                        : selectedHasWorkDay &&
                            selectedHasVabDay &&
                            selectedHasSickness
                          ? 'Arbete + VAB + sjukdom'
                          : selectedHasWorkDay &&
                              selectedHasSemester &&
                              selectedHasSickness
                            ? 'Arbete + semester + sjukdom'
                            : selectedHasWorkDay && selectedHasVabDay
                              ? 'Arbete + VAB'
                              : selectedHasWorkDay && selectedHasSemester
                                ? 'Arbete + semester'
                                : selectedHasWorkDay && selectedHasSickness
                                  ? 'Arbete + sjukdom'
                                  : selectedHasWorkDay
                                    ? 'Arbete'
                                    : selectedHasVabDay &&
                                        selectedHasSemester &&
                                        selectedHasSickness
                                      ? 'VAB + semester + sjukdom'
                                      : selectedHasVabDay && selectedHasSemester
                                        ? 'VAB + semester'
                                        : selectedHasVabDay &&
                                            selectedHasSickness
                                          ? 'VAB + sjukdom'
                                          : selectedHasSemester &&
                                              selectedHasSickness
                                            ? 'Semester + sjukdom'
                                            : selectedHasVabDay
                                              ? 'VAB'
                                              : selectedHasSemester
                                                ? 'Semester'
                                                : selectedHasSickness
                                                  ? 'Sjukdom'
                                                  : 'Dag'}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {selectedISO}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedISO(null)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Stäng
              </button>
            </div>

            {selectedInfo.total <= 0 &&
            (selectedHasWorkDay ||
              selectedVab ||
              selectedHasSemester ||
              selectedHasSickness) ? (
              <div className="mt-4 flex items-center justify-center gap-6">
                {selectedShowExpress ? (
                  <motion.div
                    style={{
                      x: expressX,
                      y: expressY,
                      rotate: expressRotate,
                      willChange: 'transform',
                    }}
                  >
                    <Image
                      src="/express.png"
                      alt="Arbete"
                      width={120}
                      height={120}
                    />
                  </motion.div>
                ) : null}
                {selectedHasSemester ? (
                  <div className="animate-gentle-bounce">
                    <Image
                      src="/semester.png"
                      alt="Semester"
                      width={120}
                      height={120}
                    />
                  </div>
                ) : null}
                {selectedHasSickness ? (
                  <div className="animate-gentle-bounce">
                    <Image
                      src="/temp.png"
                      alt="Sjukdom"
                      width={120}
                      height={120}
                    />
                  </div>
                ) : null}
                {selectedHasVabDay ? (
                  <div className="animate-gentle-bounce">
                    <Image src="/vab.png" alt="VAB" width={120} height={120} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedInfo.total > 0 || selectedArt302 ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-xs font-semibold text-gray-700">
                  Övertid
                </div>

                {selectedInfo.total > 0 ? (
                  <>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
                      {minutesToLabel(selectedInfo.total)}
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs">
                      {(
                        [
                          { art: '301', label: 'utbetald', minutes: selectedInfo.minutes301 },
                          { art: '311', label: 'till komp', minutes: selectedInfo.minutes311 },
                          { art: '31101', label: 'till komp, 1,4x', minutes: selectedInfo.minutes31101 },
                          { art: '312', label: 'kval till komp', minutes: selectedInfo.minutes312 },
                          { art: '31201', label: 'kval omräkning, 2x', minutes: selectedInfo.minutes31201 },
                        ] as { art: string; label: string; minutes: number }[]
                      ).map(({ art, label, minutes }) =>
                        minutes > 0 ? (
                          <div key={art} className="flex items-baseline justify-between gap-2 font-semibold text-gray-900">
                            <span>ART {art} ({label})</span>
                            <span className="tabular-nums text-red-700">{minutesToLabel(minutes)}</span>
                          </div>
                        ) : (
                          <div key={art} className="flex items-baseline justify-between gap-2 text-gray-400">
                            <span>ART {art} ({label})</span>
                            <span>–</span>
                          </div>
                        ),
                      )}

                      {(() => {
                        const note = qualRelationNote(
                          selectedInfo.minutes312,
                          selectedInfo.minutes31201,
                        );
                        return note ? (
                          <div className="mt-2 text-amber-700">{note}</div>
                        ) : null;
                      })()}
                    </div>
                  </>
                ) : null}

                {selectedArt302 ? (
                  <div
                    className={
                      selectedInfo.total > 0
                        ? 'mt-3 rounded-lg border border-red-100 bg-white p-3'
                        : 'mt-2 rounded-lg border border-red-100 bg-white p-3'
                    }
                  >
                    <div className="text-xs font-semibold text-gray-700">
                      ART 302 (kvalificerad)
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <div className="text-gray-600">Timmar</div>
                      <div className="tabular-nums font-semibold text-gray-900">
                        {fmtHours.format(selectedArt302.hours)} h
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <div className="text-gray-600">Summa</div>
                      <div className="tabular-nums font-semibold text-gray-900">
                        {fmtSek.format(selectedArt302.sek)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedHasSemester ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-700">
                  Semester (700)
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  Denna dag är markerad som semester.
                </div>
              </div>
            ) : null}

            {selectedHasWorkDay ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-700">
                  Arbete ({selectedPlusHours > 0 ? '315 + 483' : '315'})
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  Timmar som har registrerats denna dag (summa):{' '}
                  <span className="tabular-nums font-semibold text-gray-900">
                    {fmtHours.format(selectedWorkHours)} h
                  </span>
                </div>
                {selectedPlusHours > 0 ? (
                  <div className="mt-1 text-xs text-gray-600">
                    Varav{' '}
                    <span className="tabular-nums font-semibold text-gray-900">
                      {fmtHours.format(selectedPlusHours)} h
                    </span>{' '}
                    plustid (483) — tid över årsarbetstidstaket (5 h ×
                    månadens dagar).
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedHasSickness ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-700">
                  Sjukdom (80001)
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  Denna dag är markerad som sjukdom/karenstillfälle.
                </div>
              </div>
            ) : null}

            {selectedHasVabDay ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-700">
                  VAB (81001)
                </div>
                {selectedVab ? (
                  <>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <div className="text-gray-600">Tid</div>
                      <div className="tabular-nums font-semibold text-gray-900">
                        {fmtHours.format(selectedVab.hours)} h
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <div className="text-gray-600">Summa</div>
                      <div className="tabular-nums font-semibold text-gray-900">
                        {fmtSek.format(selectedVab.sek)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-gray-700">
                    Denna dag är markerad som VAB.
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-3 text-[11px] text-gray-500">
              Tips: Tryck ESC för att stänga.
            </div>

            {selectedInfo.total > 0 || selectedArt302 ? (
              <div className="pointer-events-none absolute bottom-3 right-3 opacity-90">
                <div className="rotate-[20deg]">
                  <Image
                    src="/ticktack.png"
                    alt="Övertid"
                    width={56}
                    height={56}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function countRows(groups: PayslipArtGroups['artGroups']) {
  return groups.reduce((sum, g) => sum + (g.rows?.length ?? 0), 0);
}

export function PayslipArtGroupsPanel({
  fileName,
  artGroups,
  lines,
  sections,
  totals,
}: PayslipArtGroups) {
  const totalRows = React.useMemo(() => countRows(artGroups), [artGroups]);

  const overview = React.useMemo(
    () => summarizePayslipArtGroups(artGroups, { sections, totals }),
    [artGroups, sections, totals],
  );

  // Art '0' bär den anställdes namn, inte en lönerad — den hör inte hemma
  // i grupptabellen.
  const sorted = React.useMemo(() => {
    return [...artGroups]
      .filter((g) => g.art !== '0')
      .sort((a, b) => (b.rows?.length ?? 0) - (a.rows?.length ?? 0));
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
    if (overview.art302) set.add('302');
    if (overview.art320) set.add('320');

    if (overview.art2101) set.add('2101');
    if (overview.art9001) set.add('9001');
    if (overview.art9002) set.add('9002');
    if (overview.art0641) set.add('0641');
    if (overview.art0644) set.add('0644');
    if (overview.art070) set.add('070');
    if (overview.art4851) set.add('4851');
    if (overview.art350) set.add('350');
    if (overview.art80001) set.add('80001');
    if (overview.art70001) set.add('70001');
    if (overview.artK7022) set.add('K7022');
    if (overview.artK315) set.add('K315');

    // VAB-card in overview effectively covers both 810 and 81001.
    if (overview.art810 || overview.art81001) {
      set.add('810');
      set.add('81001');
    }
    if (overview.art81103) set.add('81103');

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
    return (overview.byArt ?? []).filter(
      (r) => !artsCoveredInOverview.has(r.art),
    );
  }, [overview.byArt, artsCoveredInOverview]);

  const sortedNotInOverview = React.useMemo(() => {
    return (sorted ?? []).filter((g) => !artsCoveredInOverview.has(g.art));
  }, [sorted, artsCoveredInOverview]);

  const formatSek = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
    }).format(n);
  }, []);

  const formatInt = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(
      n,
    );
  }, []);

  const formatHours = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(
      n,
    );
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

  const art302 = overview.art302;

  const art700 = overview.art700;
  const art700DatesISO = art700?.datesISO ?? EMPTY_DATES;
  const art700DaysCount = art700DatesISO.length;
  const art700GeneratedHours = art700DaysCount * 5;

  const art320 = overview.art320;

  const art9001 = overview.art9001;
  const art9002 = overview.art9002;
  const art0641 = overview.art0641;
  const art0644 = overview.art0644;
  const art070 = overview.art070;
  const art4851 = overview.art4851;
  const art534 = overview.art534;
  const art350 = overview.art350;
  const art80001 = overview.art80001;
  const art70001 = overview.art70001;
  const artK7022 = overview.artK7022;
  const fackforeningsavgift = overview.fackforeningsavgift;
  const friskvard = overview.friskvard;

  const art010 = overview.art010;
  const art702 = overview.art702;
  const artK702 = overview.artK702;
  const art90016 = overview.art90016;
  const art600 = overview.art600;
  const artK925 = overview.artK925;
  const lonebesked = overview.lonebesked;
  const sektioner = overview.sections;
  const okandaArter = overview.okandaArter;

  const art81001 = overview.art81001;
  const art81103 = overview.art81103;
  const artK315 = overview.artK315;
  const art483 = overview.art483;
  const art483TotalMinutes = art483 ? Math.round(art483.hoursTotal * 60) : 0;
  const art483Hours = Math.floor(art483TotalMinutes / 60);
  const art483Minutes = Math.abs(art483TotalMinutes % 60);

  /**
   * Långdagar — dygn med mer än 10,5 h arbetad tid. Dagarna räknas fram ur
   * specens egna timmar (verklig arbetstid = nominell tid 315 + plustid 483)
   * och det förväntade tillägget jämförs mot K315-raderna, så att ett uteblivet
   * eller felräknat långdagstillägg syns.
   */
  const langdagar = React.useMemo(() => {
    const nominell = art315?.hoursByDateISO ?? {};
    const plus = art483?.hoursByDateISO ?? {};
    const utbetaltByDate = artK315?.hoursByDateISO ?? {};

    const rows = Array.from(
      new Set([...Object.keys(nominell), ...Object.keys(plus)]),
    )
      .sort()
      .map((iso) => {
        const arbetad = (nominell[iso] ?? 0) + (plus[iso] ?? 0);
        const over = arbetad - LANGDAG_GRANS_H;
        return {
          iso,
          arbetad,
          over,
          // Specen avrundar tillägget per dag till två decimaler — gör likadant
          // så att summan går att jämföra rakt av.
          berakning: Math.round(over * LANGDAG_FAKTOR * 100) / 100,
          utbetalt: utbetaltByDate[iso] ?? 0,
        };
      })
      .filter((r) => r.over > 0.005);

    const overTotal = rows.reduce((sum, r) => sum + r.over, 0);
    const berakningTotal = rows.reduce((sum, r) => sum + r.berakning, 0);
    const avvikande = rows.filter(
      (r) => Math.abs(r.berakning - r.utbetalt) > 0.005,
    );

    return {
      rows,
      overTotal,
      berakningTotal: Math.round(berakningTotal * 100) / 100,
      utbetaltTotal: artK315?.hoursTotal ?? 0,
      avvikande,
    };
  }, [art315, art483, artK315]);

  const moneyOverview = React.useMemo(() => {
    const items: Array<{ label: string; amount: number; count?: number }> = [];

    const pushIfNumber = (
      label: string,
      amount: number | null | undefined,
      opts?: { count?: number },
    ) => {
      if (
        typeof amount !== 'number' ||
        !Number.isFinite(amount) ||
        amount === 0
      )
        return;
      items.push({ label, amount, count: opts?.count });
    };

    pushIfNumber('Timlön (010)', art010?.sekTotal, {
      count: art010?.rowsCount,
    });
    pushIfNumber('Månadslön (070)', art070?.sekTotal);
    pushIfNumber('Övertid (301)', art301?.sekTotalComputed);
    pushIfNumber('Övertid, kvalificerad (302)', art302?.sekTotalComputed);
    pushIfNumber('Ersättn sjukvård skattepl (4851)', art4851?.sekTotal);
    pushIfNumber('OB-tillägg kontant (350)', art350?.sekTotalComputed);
    pushIfNumber('Däckmanstillägg (0641)', art0641?.sekTotal);
    pushIfNumber('Rederitillägg (0644)', art0644?.sekTotal);
    pushIfNumber('Maskinskötseltillägg (2101)', overview.art2101?.sekTotal, {
      count: overview.art2101?.rowsCount,
    });
    pushIfNumber('Övriga utlägg (534)', art534?.sekTotal, {
      count: art534?.rowsCount,
    });
    pushIfNumber('Semestertillägg (70001)', art70001?.sekTotalComputed);
    pushIfNumber(
      'Semesterersättning direkt rörliga (K7022)',
      artK7022?.sekTotal,
    );
    pushIfNumber('Semesterersättning löpande (702)', art702?.sekTotal, {
      count: art702?.rowsCount,
    });
    pushIfNumber(
      'Semesterersättning vid månadslön (K702)',
      artK702?.sekTotal,
    );
    pushIfNumber('Kostförmån (600)', art600?.sekTotal, {
      count: art600?.rowsCount,
    });
    pushIfNumber('Måltidsavdrag (K925)', artK925?.sekTotal, {
      count: artK925?.rowsCount,
    });

    // Money conversions / deductions
    pushIfNumber(
      'Komp → pengar (320)',
      art320?.sekTotalFromRow ?? art320?.sekTotalComputed ?? null,
    );
    pushIfNumber(
      'VAB (81001)',
      art81001?.sekTotalFromRow ?? art81001?.sekTotalComputed ?? null,
      { count: art81001?.rowsCount },
    );
    pushIfNumber(
      'Föräldraledighet, lång (81103)',
      art81103?.sekTotal,
      { count: art81103?.rowsCount },
    );
    pushIfNumber(
      'Sjukdom karens (80001)',
      art80001?.sekTotalFromRow ?? art80001?.sekTotalComputed ?? null,
    );

    // Aggregates
    pushIfNumber('Friskvård (9190 + K5441)', friskvard?.sekTotal);
    pushIfNumber('Fackföreningsavgift', fackforeningsavgift?.sekTotal);

    // Taxes
    pushIfNumber('Tabellskatt (9001)', art9001?.sekTotal);
    pushIfNumber('Engångsskatt (9002)', art9002?.sekTotal);
    pushIfNumber('Tabellskatt personnivå (90016)', art90016?.sekTotal);

    const plus = items.filter((i) => i.amount > 0);
    const minus = items.filter((i) => i.amount < 0);
    const plusTotal = plus.reduce((acc, i) => acc + i.amount, 0);
    const minusTotal = minus.reduce((acc, i) => acc + i.amount, 0);
    const sum = items.reduce((acc, i) => acc + i.amount, 0);

    return { items, plus, minus, plusTotal, minusTotal, sum };
  }, [
    art0641?.sekTotal,
    art0644?.sekTotal,
    art070?.sekTotal,
    art301?.sekTotalComputed,
    art302?.sekTotalComputed,
    art4851?.sekTotal,
    art534?.sekTotal,
    art534?.rowsCount,
    art350?.sekTotalComputed,
    art70001?.sekTotalComputed,
    artK7022?.sekTotal,
    art81001?.sekTotalComputed,
    art81001?.sekTotalFromRow,
    art81001?.rowsCount,
    art81103?.sekTotal,
    art81103?.rowsCount,
    art80001?.sekTotalComputed,
    art80001?.sekTotalFromRow,
    art9001?.sekTotal,
    art9002?.sekTotal,
    art010?.sekTotal,
    art010?.rowsCount,
    art702?.sekTotal,
    art702?.rowsCount,
    artK702?.sekTotal,
    art600?.sekTotal,
    art600?.rowsCount,
    artK925?.sekTotal,
    artK925?.rowsCount,
    art90016?.sekTotal,
    art320?.sekTotalComputed,
    art320?.sekTotalFromRow,
    fackforeningsavgift?.sekTotal,
    friskvard?.sekTotal,
    overview.art2101?.sekTotal,
    overview.art2101?.rowsCount,
  ]);

  const vabBreakdownByDayISO = React.useMemo(() => {
    const out: Record<string, { hours?: number; sek?: number }> = {};

    const hoursByDateISO =
      art81001?.hoursByDateISO ?? overview.art810?.hoursByDateISO;
    if (hoursByDateISO) {
      for (const [iso, hours] of Object.entries(hoursByDateISO)) {
        if (typeof hours !== 'number' || !Number.isFinite(hours) || hours === 0)
          continue;
        out[iso] = {
          ...(out[iso] ?? {}),
          hours: (out[iso]?.hours ?? 0) + hours,
        };
      }
    }

    if (art81001?.sekByDateISO) {
      for (const [iso, sek] of Object.entries(art81001.sekByDateISO)) {
        if (typeof sek !== 'number' || !Number.isFinite(sek) || sek === 0)
          continue;
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

  const art302BreakdownByDayISO = React.useMemo(() => {
    const out: Record<string, { hours?: number; sek?: number }> = {};
    const hoursByDateISO = overview.art302?.hoursByDateISO;
    const sekByDateISO = overview.art302?.sekByDateISO;

    if (hoursByDateISO) {
      for (const [iso, hours] of Object.entries(hoursByDateISO)) {
        if (typeof hours !== 'number' || !Number.isFinite(hours) || hours === 0)
          continue;
        out[iso] = {
          ...(out[iso] ?? {}),
          hours: (out[iso]?.hours ?? 0) + hours,
        };
      }
    }

    if (sekByDateISO) {
      for (const [iso, sek] of Object.entries(sekByDateISO)) {
        if (typeof sek !== 'number' || !Number.isFinite(sek) || sek === 0)
          continue;
        out[iso] = { ...(out[iso] ?? {}), sek: (out[iso]?.sek ?? 0) + sek };
      }
    }

    return out;
  }, [overview.art302]);

  const overtimeBreakdownByDayISO = React.useMemo(() => {
    const out: Record<
      string,
      {
        minutes301?: number;
        minutes311?: number;
        minutes31101?: number;
        minutes312?: number;
        minutes31201?: number;
      }
    > = {};
    if (art301?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art301.minutesByDateISO)) {
        if (
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes <= 0
        )
          continue;
        out[iso] = {
          ...(out[iso] ?? {}),
          minutes301: (out[iso]?.minutes301 ?? 0) + minutes,
        };
      }
    }

    // Om 31101/31201 finns för ett datum så representerar de omräknad komptid.
    // Då undviker vi dubbelräkning genom att inte lägga till 311 för samma datum.
    const hasRecalc = new Set<string>();
    if (art31101?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art31101.minutesByDateISO)) {
        if (
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes <= 0
        )
          continue;
        hasRecalc.add(iso);
        out[iso] = {
          ...(out[iso] ?? {}),
          minutes31101: (out[iso]?.minutes31101 ?? 0) + minutes,
        };
      }
    }
    if (art31201?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art31201.minutesByDateISO)) {
        if (
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes <= 0
        )
          continue;
        hasRecalc.add(iso);
        out[iso] = {
          ...(out[iso] ?? {}),
          minutes31201: (out[iso]?.minutes31201 ?? 0) + minutes,
        };
      }
    }

    // 312 (kval till komp): include even if 31201 exists so we can validate relation.
    if (art312?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art312.minutesByDateISO)) {
        if (
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes <= 0
        )
          continue;
        out[iso] = {
          ...(out[iso] ?? {}),
          minutes312: (out[iso]?.minutes312 ?? 0) + minutes,
        };
      }
    }

    if (art311?.minutesByDateISO) {
      for (const [iso, minutes] of Object.entries(art311.minutesByDateISO)) {
        if (hasRecalc.has(iso)) continue;
        if (
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes <= 0
        )
          continue;
        out[iso] = {
          ...(out[iso] ?? {}),
          minutes311: (out[iso]?.minutes311 ?? 0) + minutes,
        };
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
  const sicknessDaysISO = overview.art80001?.datesISO ?? [];
  const semesterDaysISO = overview.art700?.datesISO ?? EMPTY_DATES;

  // Arbetsdagar i kalendern: art315 för tillsvidareanställda och art010 för
  // timanställda. Utan 010 står kalendern omarkerad för en timanställd trots
  // att specen tolkats rätt.
  const arbetstimmarPerDag = React.useMemo(() => {
    const nominell = art315?.hoursByDateISO ?? {};
    const timlon = art010?.hoursByDateISO ?? {};
    if (!Object.keys(timlon).length) return nominell;

    const ut: Record<string, number> = { ...nominell };
    for (const [iso, h] of Object.entries(timlon)) {
      ut[iso] = (ut[iso] ?? 0) + h;
    }
    return ut;
  }, [art315, art010]);

  const arbetsdagarISO = React.useMemo(
    () => Object.keys(arbetstimmarPerDag).sort(),
    [arbetstimmarPerDag],
  );

  return (
    <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-sm font-medium text-gray-900">
          {fileName ? fileName : 'Lönespecifikation'}
        </p>
      </div>

      <div className="space-y-4 p-5">
        {/* Sidans huvudtal — vad som faktiskt landar på kontot. */}
        {lonebesked && typeof lonebesked.netto === 'number' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Att utbetala
            </div>

            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <div className="text-4xl font-bold tabular-nums text-emerald-900">
                {formatSek(lonebesked.netto)}
              </div>
              {lonebesked.utbetalningsdag ? (
                <div className="pb-1 text-sm text-emerald-800">
                  Utbetalas {lonebesked.utbetalningsdag}
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-x-8 gap-y-2 border-t border-emerald-200 pt-3 text-sm sm:grid-cols-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-emerald-900/70">Bruttolön</span>
                <span className="tabular-nums font-semibold text-emerald-900">
                  {formatSek(
                    lonebesked.bruttoFranSpec ?? lonebesked.bruttoBerakat,
                  )}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-emerald-900/70">Skatt</span>
                <span className="tabular-nums font-semibold text-emerald-900">
                  {formatSek(lonebesked.skatt)}
                </span>
              </div>
              {lonebesked.ovrigaAvdrag !== 0 ? (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-emerald-900/70">Övriga avdrag</span>
                  <span className="tabular-nums font-semibold text-emerald-900">
                    {formatSek(lonebesked.ovrigaAvdrag)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Flera anställningar i samma spec — förklarar hur nettot är uppdelat. */}
        {sektioner && sektioner.length > 1 ? (
          <Kort
            titel="Anställningar"
            underrubrik="Specen omfattar flera anställningar. Beloppen ovan är summan av dem."
          >
            {sektioner.map((sek, i) => (
              <Rad
                key={sek.anstallning ?? `gemensam-${i}`}
                etikett={
                  sek.anstallning
                    ? `Anställning ${sek.anstallning}`
                    : 'Gemensamma uppgifter'
                }
                detalj={`Arter: ${sek.arter.join(", ")}`}
                varde={
                  <span className="text-right">
                    {typeof sek.brutto === 'number' ? (
                      <span className="block">{formatSek(sek.brutto)}</span>
                    ) : null}
                    {sek.skatt !== 0 ? (
                      <span className="block text-xs font-normal text-gray-500">
                        skatt {formatSek(sek.skatt)}
                      </span>
                    ) : null}
                  </span>
                }
              />
            ))}
          </Kort>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Kort titel="Det här består lönen av">
            {moneyOverview.plus.length ? (
              <>
                <Underrubrik>Lön och tillägg</Underrubrik>
                {moneyOverview.plus.map((it) => (
                  <Rad
                    key={it.label}
                    etikett={it.label}
                    detalj={
                      typeof it.count === 'number' && Number.isFinite(it.count)
                        ? `${it.count} rader`
                        : undefined
                    }
                    varde={formatSek(it.amount)}
                  />
                ))}
                <Rad
                  etikett="Summa lön och tillägg"
                  varde={formatSek(moneyOverview.plusTotal)}
                  stark
                />
              </>
            ) : null}

            {moneyOverview.minus.length ? (
              <>
                <Underrubrik>Avdrag</Underrubrik>
                {moneyOverview.minus.map((it) => (
                  <Rad
                    key={it.label}
                    etikett={it.label}
                    detalj={
                      typeof it.count === 'number' && Number.isFinite(it.count)
                        ? `${it.count} rader`
                        : undefined
                    }
                    varde={formatSek(it.amount)}
                  />
                ))}
                <Rad
                  etikett="Summa avdrag"
                  varde={formatSek(moneyOverview.minusTotal)}
                  stark
                />
              </>
            ) : null}

            {!moneyOverview.items.length ? (
              <Rad etikett="Inga belopp hittades i PDF:en" varde="–" />
            ) : null}
          </Kort>

          <Kort titel="Arbetad tid">
            {art315 ? (
              <Rad
                etikett="Arbetstid"
                detalj="Nominell tid, art 315"
                varde={`${formatInt(art315Hours)} h ${formatInt(art315Minutes)} min`}
              />
            ) : null}

            {art010 ? (
              <Rad
                etikett="Timlön"
                detalj={`Art 010 · ${formatInt(art010.rowsCount)} dagar`}
                varde={`${formatHours(art010.hoursTotal)} h`}
              />
            ) : null}

            {art483 ? (
              <Rad
                etikett="Plustid"
                detalj="Art 483 · tid över årsarbetstidstaket (5 h × månadens dagar)"
                varde={`${formatInt(art483Hours)} h ${formatInt(art483Minutes)} min`}
              />
            ) : null}

            {artK315 || langdagar.rows.length > 0 ? (
              <Rad
                etikett="Långdagstillägg"
                detalj={`Art K315 · ${formatInt(langdagar.rows.length)} dygn över 10,5 h, ${formatHours(langdagar.overTotal)} h däröver`}
                varde={`${formatHours(langdagar.utbetaltTotal)} h`}
              />
            ) : null}

            {art301 ? (
              <Rad
                etikett="Övertid"
                detalj="Art 301 · utbetald"
                varde={`${formatHours(art301.hoursTotal)} h`}
              />
            ) : null}

            {art302 ? (
              <Rad
                etikett="Övertid, kvalificerad"
                detalj="Art 302 · utbetald"
                varde={`${formatHours(art302.hoursTotal)} h`}
              />
            ) : null}

            {art311 ? (
              <Rad
                etikett="Övertid till komp"
                detalj="Art 311 · sparas i kompsaldot"
                varde={`${formatInt(art311Hours)} h ${formatInt(art311Minutes)} min`}
              />
            ) : null}

            {art312 ? (
              <Rad
                etikett="Kval. övertid till komp"
                detalj="Art 312 · sparas i kompsaldot"
                varde={`${formatInt(art312Hours)} h ${formatInt(art312Minutes)} min`}
              />
            ) : null}

            {art31101 ? (
              <Rad
                etikett="Komp efter omräkning"
                detalj="Art 31101 · art 311 × 1,4"
                varde={`${formatInt(art31101Hours)} h ${formatInt(art31101Minutes)} min`}
              />
            ) : null}

            {art31201 ? (
              <Rad
                etikett="Komp efter omräkning, helg"
                detalj="Art 31201 · art 312 × 2"
                varde={`${formatInt(art31201Hours)} h ${formatInt(art31201Minutes)} min`}
              />
            ) : null}

            {art700 ? (
              <Rad
                etikett="Semester"
                detalj="Art 700 · varje dag räknas som 5 timmars arbete"
                varde={`${formatInt(art700DaysCount)} dagar (${formatInt(art700GeneratedHours)} h)`}
              />
            ) : null}

            {overview.art810 || art81001 ? (
              <Rad
                etikett="VAB"
                detalj="Art 810/81001"
                varde={`${formatHours(art81001?.hoursTotal ?? overview.art810?.hoursTotal ?? 0)} h`}
              />
            ) : null}

            {!art315 &&
            !art010 &&
            !art301 &&
            !art302 &&
            !art311 &&
            !art700 ? (
              <Rad etikett="Inga tidrader hittades i PDF:en" varde="–" />
            ) : null}
          </Kort>
        </div>

        {calendarMonthISO ? (
          <MonthCalendar
            monthISO={calendarMonthISO}
            overtimeBreakdownByDayISO={overtimeBreakdownByDayISO}
            workDaysISO={arbetsdagarISO}
            workHoursByDayISO={arbetstimmarPerDag}
            plusHoursByDayISO={art483?.hoursByDateISO}
            art302DatesISO={art302DatesISO}
            art302BreakdownByDayISO={art302BreakdownByDayISO}
            sicknessDaysISO={sicknessDaysISO}
            semesterDaysISO={semesterDaysISO}
            vabDaysISO={vabDaysISO}
            vabBreakdownByDayISO={vabBreakdownByDayISO}
            caption={
              hasAnyOvertime
                ? 'Klicka på en dag för detaljer.'
                : 'Inga övertidsrader i denna PDF. Klicka på en dag för detaljer.'
            }
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Kunde inte avgöra vilken månad specen avser, så kalendern visas
            inte.
          </div>
        )}

        {okandaArter && okandaArter.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-xs font-semibold text-amber-800">
              {okandaArter.length === 1
                ? 'En art tolkas inte och ingår inte i summorna'
                : `${okandaArter.length} arter tolkas inte och ingår inte i summorna`}
            </div>
            <div className="mt-1 space-y-0.5 text-sm text-amber-900">
              {okandaArter.map((a) => (
                <div
                  key={a.art}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span>
                    <span className="font-mono">{a.art}</span>
                    {a.description ? ` ${a.description}` : ''}
                  </span>
                  <span className="tabular-nums text-amber-800/70">
                    {a.rowsCount} rader
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <details className="rounded-xl border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
            Visa rådata från PDF:en
          </summary>

          <div className="space-y-4 border-t border-gray-100 p-4">
            <p className="text-xs text-gray-500">
              {artGroups.length} grupper, {totalRows} rader. Rader som börjar
              med ett artnummer plockas ut med{' '}
              <span className="font-mono">
                /^(\d{'{'}2,5{'}'}|K\d{'{'}3,5{'}'})\s/
              </span>
              .
            </p>

            {byArtNotInOverview.length ? (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
                  <div className="text-xs font-semibold text-gray-600">Art</div>
                  <div className="text-xs font-semibold text-gray-600">
                    Rubrik (från första raden)
                  </div>
                  <div className="text-right text-xs font-semibold text-gray-600">
                    Rader
                  </div>
                </div>
                <div className="max-h-[260px] overflow-auto">
                  {byArtNotInOverview.map((r) => (
                    <div
                      key={r.art}
                      className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-100 px-4 py-3"
                    >
                      <div className="font-mono text-sm text-gray-800">
                        {r.art}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {r.description}
                      </div>
                      <div className="tabular-nums text-right text-sm font-semibold text-gray-900">
                        {r.rowsCount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {sortedNotInOverview.length ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {sortedNotInOverview.map((g) => (
                  <div
                    key={g.art}
                    className="overflow-hidden rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {g.art}
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="tabular-nums font-semibold text-gray-900">
                          {g.rows.length}
                        </span>{' '}
                        rader
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
              <p className="text-sm text-gray-600">
                Alla arter i specen tolkas och visas ovan.
              </p>
            )}

            {lines?.length ? (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
                  Textrader ur PDF:en ({lines.length})
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs text-gray-800">
                  {lines.map((l) => `${l.y.toFixed(1)}\t${l.text}`).join('\n')}
                </pre>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  );
}

/** Kort med rubrik och rader åtskilda av tunna linjer. */
function Kort({
  titel,
  underrubrik,
  children,
}: {
  titel: string;
  underrubrik?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{titel}</div>
        {underrubrik ? (
          <div className="mt-0.5 text-xs text-gray-500">{underrubrik}</div>
        ) : null}
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

/** Grupprubrik inuti ett kort. */
function Underrubrik({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </div>
  );
}

/** Etikett till vänster, värde till höger. Detaljraden förklarar arten. */
function Rad({
  etikett,
  detalj,
  varde,
  stark,
}: {
  etikett: string;
  detalj?: string;
  varde: React.ReactNode;
  stark?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <div
          className={
            stark
              ? 'text-sm font-semibold text-gray-900'
              : 'text-sm text-gray-700'
          }
        >
          {etikett}
        </div>
        {detalj ? (
          <div className="mt-0.5 text-xs text-gray-500">{detalj}</div>
        ) : null}
      </div>
      <div className="shrink-0 tabular-nums text-sm font-semibold text-gray-900">
        {varde}
      </div>
    </div>
  );
}
