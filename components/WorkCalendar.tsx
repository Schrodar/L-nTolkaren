'use client';

import * as React from 'react';
import {
  addMonths,
  format,
  getISOWeek,
  isSameDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { sv } from 'date-fns/locale';

import { BoatSelect } from '@/components/BoatSelect';
import { DayModal } from '@/components/DayModal';
import { MonthSummary } from '@/components/MonthSummary';
import { useLoneberakningContext } from '@/components/LoneberakningContext';
import {
  applyWorkedDefaults,
  buildMonthState,
  createDefaultDayEntry,
  getMonthGridDates,
  isDayEntryEmpty,
  isSameMonth,
  normalizeDateISO,
} from '@/lib/calendar/helpers';
import type { DayEntry } from '@/lib/calendar/types';
import { resolveDay } from '@/lib/schedule/resolveDay';
import type {
  BoatOption,
  BoatScheduleCompact,
  ResolvedDaySchedule,
} from '@/lib/schedule/types';

const WEEKDAY_LABELS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const ENTRIES_STORAGE_KEY = 'work-calendar-day-entries-v2';
const BOAT_STORAGE_KEY = 'work-calendar-selected-boat-v1';
const SCHEDULE_SEASON = 'ao_vinter_2025_26';

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function durationToMinutes(duration?: string): number {
  if (!duration) return 0;
  const match = duration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const h = Number(match[1] ?? '0');
  const m = Number(match[2] ?? '0');
  const s = Number(match[3] ?? '0');
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) {
    return 0;
  }
  return h * 60 + m + Math.round(s / 60);
}

function spanMinutes(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null) return 0;

  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function getWorkedHoursFromResolvedDay(
  resolved: ResolvedDaySchedule,
): number | null {
  const totalMinutes = resolved.shifts.reduce((total, shift) => {
    const workMinutes = shift.work?.duration
      ? durationToMinutes(shift.work.duration)
      : spanMinutes(shift.work?.start, shift.work?.end);

    const breaksMinutes = (shift.breaks ?? []).reduce(
      (breakTotal, breakSpan) => {
        return breakTotal + spanMinutes(breakSpan.start, breakSpan.end);
      },
      0,
    );

    return total + Math.max(0, workMinutes - breaksMinutes);
  }, 0);

  const sum = totalMinutes / 60;
  return sum > 0 ? sum : null;
}

export function WorkCalendar() {
  const { selectedCalendarYear, setSelectedCalendarYear, selectedTariffDate } =
    useLoneberakningContext();

  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return startOfMonth(new Date(selectedCalendarYear, now.getMonth(), 1));
  });

  const [entriesByDateISO, setEntriesByDateISO] = React.useState<
    Record<string, DayEntry>
  >(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(ENTRIES_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, DayEntry>;
    } catch {
      return {};
    }
  });

  const [availableBoats, setAvailableBoats] = React.useState<BoatOption[]>([]);
  const [selectedBoat, setSelectedBoat] = React.useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(BOAT_STORAGE_KEY) ?? '';
  });
  const [boatSchedule, setBoatSchedule] =
    React.useState<BoatScheduleCompact | null>(null);

  const [selectedDateISO, setSelectedDateISO] = React.useState<string | null>(
    null,
  );
  const [selectedResolvedDay, setSelectedResolvedDay] =
    React.useState<ResolvedDaySchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    window.localStorage.setItem(
      ENTRIES_STORAGE_KEY,
      JSON.stringify(entriesByDateISO),
    );
  }, [entriesByDateISO]);

  React.useEffect(() => {
    window.localStorage.setItem(BOAT_STORAGE_KEY, selectedBoat);
  }, [selectedBoat]);

  React.useEffect(() => {
    const yearFromMonth = currentMonth.getFullYear();
    if (yearFromMonth !== selectedCalendarYear) {
      setSelectedCalendarYear(yearFromMonth);
    }
  }, [currentMonth, selectedCalendarYear, setSelectedCalendarYear]);

  React.useEffect(() => {
    let canceled = false;

    async function loadBoats() {
      try {
        const response = await fetch(
          `/api/schedules?season=${encodeURIComponent(SCHEDULE_SEASON)}`,
        );
        const data = (await response.json()) as { boats?: BoatOption[] };
        if (!canceled) {
          setAvailableBoats(Array.isArray(data.boats) ? data.boats : []);
        }
      } catch {
        if (!canceled) {
          setAvailableBoats([]);
        }
      }
    }

    loadBoats();
    return () => {
      canceled = true;
    };
  }, []);

  React.useEffect(() => {
    let canceled = false;

    async function loadSchedule() {
      if (!selectedBoat) {
        setBoatSchedule(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/schedules?season=${encodeURIComponent(SCHEDULE_SEASON)}&boat=${encodeURIComponent(selectedBoat)}`,
        );
        if (!response.ok) {
          if (!canceled) setBoatSchedule(null);
          return;
        }

        const data = (await response.json()) as {
          schedule?: BoatScheduleCompact | null;
        };
        if (!canceled) {
          setBoatSchedule(data.schedule ?? null);
        }
      } catch {
        if (!canceled) {
          setBoatSchedule(null);
        }
      }
    }

    loadSchedule();
    return () => {
      canceled = true;
    };
  }, [selectedBoat]);

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2500);
  }, []);

  const today = React.useMemo(() => new Date(), []);
  const gridDates = React.useMemo(
    () => getMonthGridDates(currentMonth),
    [currentMonth],
  );

  const currentYear = currentMonth.getFullYear();
  const yearOptions = React.useMemo(
    () => Array.from({ length: 21 }, (_, index) => currentYear - 10 + index),
    [currentYear],
  );

  const monthLabel = capitalizeFirst(
    format(currentMonth, 'LLLL', { locale: sv }),
  );
  const monthISO = format(currentMonth, 'yyyy-MM');
  const selectedTariffYear = selectedTariffDate.slice(0, 4);

  const monthState = React.useMemo(
    () => buildMonthState(monthISO, entriesByDateISO),
    [monthISO, entriesByDateISO],
  );

  const selectedEntry = selectedDateISO
    ? entriesByDateISO[selectedDateISO]
    : undefined;

  const selectedDayDefaultWorkedHours = React.useMemo(
    () =>
      selectedResolvedDay
        ? getWorkedHoursFromResolvedDay(selectedResolvedDay)
        : null,
    [selectedResolvedDay],
  );

  function openDateModal(date: Date) {
    if (!selectedBoat) {
      showToast('Välj båt först för att hämta schema.');
      return;
    }

    const dateISO = normalizeDateISO(date);
    const resolved = boatSchedule
      ? resolveDay(boatSchedule, dateISO)
      : {
          dateISO,
          shifts: [],
          isStandard: true,
          notes: [],
          flags: [],
        };

    if (!entriesByDateISO[dateISO]) {
      const defaultHours = getWorkedHoursFromResolvedDay(resolved);
      if (defaultHours !== null && defaultHours > 0) {
        setEntriesByDateISO((prev) => ({
          ...prev,
          [dateISO]: {
            ...createDefaultDayEntry(dateISO),
            worked: true,
            workedHours: defaultHours,
          },
        }));
      }
    }

    setSelectedResolvedDay(resolved);
    setSelectedDateISO(dateISO);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function handleYearChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextYear = Number(event.target.value);
    const next = new Date(currentMonth);
    next.setFullYear(nextYear);
    setCurrentMonth(startOfMonth(next));
    setSelectedCalendarYear(nextYear);
  }

  function handleSaveEntry(entry: DayEntry) {
    const normalized = applyWorkedDefaults(entry);
    setEntriesByDateISO((prev) => {
      const next = { ...prev };
      if (isDayEntryEmpty(normalized)) {
        delete next[normalized.dateISO];
      } else {
        next[normalized.dateISO] = normalized;
      }
      return next;
    });
    setIsModalOpen(false);
  }

  function handleDeleteEntry() {
    if (!selectedDateISO) return;
    setEntriesByDateISO((prev) => {
      const next = { ...prev };
      delete next[selectedDateISO];
      return next;
    });
    setIsModalOpen(false);
  }

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-3">
          <BoatSelect
            boats={availableBoats}
            value={selectedBoat}
            onChange={setSelectedBoat}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
              aria-label="Föregående månad"
            >
              Föregående månad
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
              aria-label="Nästa månad"
            >
              Nästa månad
            </button>
          </div>

          <h2 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            {monthLabel}
          </h2>

          <label className="flex items-center gap-2 text-sm text-[#F5F7FF]/90">
            <span>År</span>
            <select
              value={currentYear}
              onChange={handleYearChange}
              className="rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mb-4 text-xs text-[#F5F7FF]/70">
          Aktiv tariff: {selectedTariffYear}
        </p>

        <div className="overflow-x-auto">
          <div className="min-w-160">
            <div className="flex border-b border-white/10 bg-white/5 text-sm font-medium text-[#F5F7FF]/80">
              <div className="w-16 border-r border-white/20 bg-white/5 px-3 py-2 text-right">
                V.
              </div>
              <div className="grid flex-1 grid-cols-7 bg-white/5">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-3 py-2">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div>
              {Array.from(
                { length: Math.ceil(gridDates.length / 7) },
                (_, weekIndex) => {
                  const week = gridDates.slice(
                    weekIndex * 7,
                    weekIndex * 7 + 7,
                  );

                  return (
                    <div key={week[0].toISOString()} className="flex">
                      <div className="flex h-16 w-16 items-center justify-end border-r border-white/20 bg-white/5 px-3 text-sm text-[#F5F7FF]/70">
                        {getISOWeek(week[0])}
                      </div>
                      <div className="grid flex-1 grid-cols-7 bg-white/10">
                        {week.map((date) => {
                          const inCurrentMonth = isSameMonth(date, monthISO);
                          const isToday = isSameDay(date, today);
                          const dateISO = normalizeDateISO(date);
                          const entry = entriesByDateISO[dateISO];

                          const resolved = boatSchedule
                            ? resolveDay(boatSchedule, dateISO)
                            : null;

                          const hasWorked = entry?.worked;
                          const hasOvertime =
                            (entry?.overtimeSimpleHours ?? 0) > 0 ||
                            (entry?.overtimeQualifiedHours ?? 0) > 0;
                          const hasAbsence = Boolean(entry?.absenceType);

                          return (
                            <button
                              key={date.toISOString()}
                              type="button"
                              onClick={() => openDateModal(date)}
                              aria-disabled={!selectedBoat}
                              className={[
                                'relative h-16 border border-white/10 px-2 py-1 text-left text-sm transition-colors',
                                selectedBoat
                                  ? 'hover:bg-white/15'
                                  : 'cursor-not-allowed opacity-70',
                                inCurrentMonth
                                  ? 'text-[#F5F7FF]'
                                  : 'text-[#F5F7FF]/45',
                                isToday ? 'bg-white/15 font-semibold' : '',
                                entry ? 'ring-1 ring-white/30' : '',
                                resolved && !resolved.isStandard
                                  ? 'border-amber-300/60'
                                  : '',
                              ].join(' ')}
                            >
                              <div className="flex items-center justify-between">
                                <span>{format(date, 'd')}</span>
                                {resolved && !resolved.isStandard ? (
                                  <span className="rounded bg-amber-200/30 px-1 text-[10px] text-amber-100">
                                    Avv
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {hasWorked ? (
                                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                                    Jobb
                                  </span>
                                ) : null}
                                {hasOvertime ? (
                                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                                    ÖT
                                  </span>
                                ) : null}
                                {hasAbsence ? (
                                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                                    {entry?.absenceType?.toUpperCase()}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </section>

      <MonthSummary monthState={monthState} />

      <DayModal
        isOpen={isModalOpen}
        dateISO={selectedDateISO}
        initialEntry={selectedEntry}
        resolvedDay={selectedResolvedDay}
        defaultWorkedHoursFromSchedule={selectedDayDefaultWorkedHours}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        onClose={closeModal}
      />

      {toastMessage ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-white/15 bg-[#0B1B3A] px-4 py-3 text-sm text-[#F5F7FF] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          {toastMessage}
        </div>
      ) : null}
    </>
  );
}
