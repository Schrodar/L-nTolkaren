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

import { AoUpload } from '@/components/AoUpload';
import { BoatSelect } from '@/components/BoatSelect';
import { DayModal } from '@/components/DayModal';
import { useLoneberakningContext, ALLOWANCES } from '@/components/LoneberakningContext';
import { TENURE_KEYS } from '@/lib/tariffs/types';
import {
  getMonthGridDates,
  isSameMonth,
  normalizeDateISO,
} from '@/lib/calendar/helpers';
import { resolveAoDay, calcTidEnlKollAvtHours, calcTidEnlPerShift } from '@/lib/ao/resolveAoDay';
import { getHolidayInfo, getEffectiveAoDayType } from '@/lib/ao/holidayRules';
import type { AoMode, ParsedAoSheet, StoredAoSheetMeta } from '@/lib/ao/types';
import type { BoatOption, ResolvedDaySchedule } from '@/lib/schedule/types';

const WEEKDAY_LABELS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function WorkCalendar({ refreshKey = 0 }: { refreshKey?: number }) {
  const { selectedCalendarYear, setSelectedCalendarYear, selectedTariffDate, activeAllowances, allowanceAmounts, groundSalarySelection, selectedTariff } =
    useLoneberakningContext();

  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return startOfMonth(new Date(selectedCalendarYear, now.getMonth(), 1));
  });

  // ���� Båtar från AO-lagringen ��������������������������������������������������������������������������������������������
  const [availableBoats, setAvailableBoats] = React.useState<BoatOption[]>([]);
  const [selectedBoat, setSelectedBoat] = React.useState('');
  const [boatListKey, setBoatListKey] = React.useState(0);

  // ���� Isläge ������������������������������������������������������������������������������������������������������������������������������
  const [selectedMode, setSelectedMode] = React.useState<AoMode>('isfri');


  // ���� Laddat AO-blad ����������������������������������������������������������������������������������������������������������������
  const [aoSheet, setAoSheet] = React.useState<ParsedAoSheet | null>(null);
  const [loadingSheet, setLoadingSheet] = React.useState(false);

  const [selectedDateISO, setSelectedDateISO] = React.useState<string | null>(null);
  const [selectedResolvedDay, setSelectedResolvedDay] =
    React.useState<ResolvedDaySchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [activeShifts, setActiveShifts] = React.useState<Set<string>>(new Set());
  const [savedHours, setSavedHours] = React.useState(0);
  const [savedShiftCount, setSavedShiftCount] = React.useState(0);
  const [pendingBoat, setPendingBoat] = React.useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = React.useState(false);
  // maskinDagar: null = follow total pass count, number = user override
  const [maskinDagarOverride, setMaskinDagarOverride] = React.useState<number | null>(null);
  // övertid per datum
  const [overtimeByDate, setOvertimeByDate] = React.useState<Record<string, number>>({});
  const [overtimeRateNormal, setOvertimeRateNormal] = React.useState(0);
  const [overtimeRateQual, setOvertimeRateQual] = React.useState(0);
  const [overtimeRateFredag, setOvertimeRateFredag] = React.useState(0);

  React.useEffect(() => {
    const yearFromMonth = currentMonth.getFullYear();
    if (yearFromMonth !== selectedCalendarYear) {
      setSelectedCalendarYear(yearFromMonth);
    }
  }, [currentMonth, selectedCalendarYear, setSelectedCalendarYear]);

  // ���� Ladda båtlista från storage/ao/ ����������������������������������������������������������������������������
  React.useEffect(() => {
    let canceled = false;

    fetch('/api/ao/sheets')
      .then((r) => r.json())
      .then((data: { success: boolean; sheets?: StoredAoSheetMeta[] }) => {
        if (canceled || !data.success) return;
        const boats: BoatOption[] = (data.sheets ?? []).map((s) => {
          const raw = s.vesselName ?? s.sheetName;
          const label = raw.replace(/\s+Reg\..*$/i, '').trim() || raw;
          return { value: s.slug, label };
        });
        setAvailableBoats(boats);
      })
      .catch(() => {
        if (!canceled) setAvailableBoats([]);
      });

    return () => { canceled = true; };
  }, [boatListKey, refreshKey]);

  // ���� Ladda AO-data när båt väljs ��������������������������������������������������������������������������������������
  React.useEffect(() => {
    let canceled = false;

    if (!selectedBoat) {
      setAoSheet(null);
      return;
    }

    setLoadingSheet(true);

    fetch(`/api/ao/sheets/${encodeURIComponent(selectedBoat)}`)
      .then((r) => r.json())
      .then((data: { success: boolean; sheet?: ParsedAoSheet }) => {
        if (canceled) return;
        setAoSheet(data.success && data.sheet ? data.sheet : null);
      })
      .catch(() => {
        if (!canceled) setAoSheet(null);
      })
      .finally(() => {
        if (!canceled) setLoadingSheet(false);
      });

    return () => { canceled = true; };
  }, [selectedBoat]);

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2500);
  }, []);

  const today = React.useMemo(() => new Date(), []);
  const gridDates = React.useMemo(() => getMonthGridDates(currentMonth), [currentMonth]);

  const currentYear = currentMonth.getFullYear();
  const yearOptions = React.useMemo(
    () => Array.from({ length: 21 }, (_, i) => currentYear - 10 + i),
    [currentYear],
  );

  const monthLabel = capitalizeFirst(format(currentMonth, 'LLLL', { locale: sv }));
  const monthISO = format(currentMonth, 'yyyy-MM');
  const selectedTariffYear = selectedTariffDate.slice(0, 4);

  const selectedDayTidEnl = React.useMemo(
    () => (selectedResolvedDay ? calcTidEnlKollAvtHours(selectedResolvedDay) : null),
    [selectedResolvedDay],
  );

  const totalActiveHours = React.useMemo(() => {
    if (!aoSheet || activeShifts.size === 0) return 0;
    let total = 0;
    const hoursByDate = new Map<string, number[]>();
    for (const key of activeShifts) {
      const sepIdx = key.lastIndexOf('::');
      const iso = key.slice(0, sepIdx);
      const idx = Number(key.slice(sepIdx + 2));
      if (!hoursByDate.has(iso)) {
        hoursByDate.set(iso, calcTidEnlPerShift(resolveAoDay(aoSheet, selectedMode, iso)));
      }
      total += hoursByDate.get(iso)![idx] ?? 0;
    }
    return total;
  }, [activeShifts, aoSheet, selectedMode]);

  function resolveForDate(dateISO: string): ResolvedDaySchedule {
    if (aoSheet) return resolveAoDay(aoSheet, selectedMode, dateISO);
    return { dateISO, shifts: [], isStandard: true, notes: [], flags: [] };
  }

  function shiftKey(dateISO: string, idx: number) {
    return `${dateISO}::${idx}`;
  }

  function toggleShift(key: string) {
    setActiveShifts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectWeek(weekDates: Date[]) {
    const allKeys: string[] = [];
    for (const date of weekDates) {
      const iso = normalizeDateISO(date);
      const r = aoSheet ? resolveAoDay(aoSheet, selectedMode, iso) : null;
      if (r && r.shifts.length > 0) {
        calcTidEnlPerShift(r).forEach((_, i) => allKeys.push(shiftKey(iso, i)));
      }
    }
    if (allKeys.length === 0) return;
    setActiveShifts((prev) => {
      const next = new Set(prev);
      const allActive = allKeys.every((k) => next.has(k));
      if (allActive) allKeys.forEach((k) => next.delete(k));
      else allKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function handleBoatChange(newBoat: string) {
    if (activeShifts.size > 0 && newBoat !== selectedBoat) {
      setPendingBoat(newBoat);
      setShowSavePrompt(true);
    } else {
      setSelectedBoat(newBoat);
      setActiveShifts(new Set());
    }
  }

  function confirmSave(save: boolean) {
    if (save) {
      setSavedHours((h) => h + totalActiveHours);
      setSavedShiftCount((c) => c + activeShifts.size);
    }
    setActiveShifts(new Set());
    setSelectedBoat(pendingBoat!);
    setPendingBoat(null);
    setShowSavePrompt(false);
  }

  function clearSaved() {
    setSavedHours(0);
    setSavedShiftCount(0);
  }

  function openDateModal(date: Date) {
    if (!selectedBoat) {
      showToast('Välj båt först för att hämta schema.');
      return;
    }

    const dateISO = normalizeDateISO(date);
    setSelectedResolvedDay(resolveForDate(dateISO));
    setSelectedDateISO(dateISO);
    setIsModalOpen(true);
  }

  function handleYearChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextYear = Number(event.target.value);
    const next = new Date(currentMonth);
    next.setFullYear(nextYear);
    setCurrentMonth(startOfMonth(next));
    setSelectedCalendarYear(nextYear);
  }

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">

        {/* Båt + isläge */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-48">
            <BoatSelect
              boats={availableBoats}
              value={selectedBoat}
              onChange={handleBoatChange}
            />
            {availableBoats.length === 0 && (
              <p className="mt-1 text-xs text-white/40">
                Inga AO-scheman importerade ännu.{' '}
                <a href="/loneberakning/ao" className="text-sky-400 underline">
                  Importera here
                </a>
              </p>
            )}
            {loadingSheet && (
              <p className="mt-1 text-xs text-white/40">Laddar schema⬦</p>
            )}
          </div>

          <label className="block text-sm text-[#F5F7FF]/90">
            Isläge
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as AoMode)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF] sm:max-w-xs"
            >
              <option value="isfri">Isfri</option>
              <option value="is">Is</option>
            </select>
          </label>
        </div>

        {/* Månadsstyrning */}
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
            <span>�&r</span>
            <select
              value={currentYear}
              onChange={handleYearChange}
              className="rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="mb-4 text-xs text-[#F5F7FF]/70">
          Aktiv tariff: {selectedTariffYear}
          {aoSheet && (
            <span className="ml-3 text-white/40">
              AO: {aoSheet.vesselName ?? aoSheet.sheetName}
              {aoSheet.validFrom && aoSheet.validTo
                ? ` · ${aoSheet.validFrom} � ${aoSheet.validTo}`
                : ''}
            </span>
          )}
        </p>

        {/* Kalenderrutnät */}
        <div className="overflow-x-auto">
          <div className="min-w-160">
            <div className="flex border-b border-white/10 bg-white/5 text-sm font-medium text-[#F5F7FF]/80">
              <div className="w-16 border-r border-white/20 bg-white/5 px-3 py-2 text-right">V.</div>
              <div className="grid flex-1 grid-cols-7 bg-white/5">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-3 py-2">{label}</div>
                ))}
              </div>
            </div>

            <div>
              {Array.from({ length: Math.ceil(gridDates.length / 7) }, (_, weekIndex) => {
                const week = gridDates.slice(weekIndex * 7, weekIndex * 7 + 7);

                return (
                  <div key={week[0].toISOString()} className="flex">
                    <button
                      type="button"
                      onClick={() => selectWeek(week)}
                      className="flex h-24 w-16 items-center justify-end border-r border-white/20 bg-white/5 px-3 text-base text-[#F5F7FF]/70 hover:bg-white/10"
                    >
                      {getISOWeek(week[0])}
                    </button>
                    <div className="grid flex-1 grid-cols-7 bg-white/10">
                      {week.map((date) => {
                        const inCurrentMonth = isSameMonth(date, monthISO);
                        const isToday = isSameDay(date, today);
                        const dateISO = normalizeDateISO(date);

                        const resolved = aoSheet
                          ? resolveAoDay(aoSheet, selectedMode, dateISO)
                          : null;

                        const isException = resolved?.flags?.includes('undantag');
                        const shiftHours = resolved ? calcTidEnlPerShift(resolved) : [];
                        const anyActive = shiftHours.some((_, i) => activeShifts.has(shiftKey(dateISO, i)));
                        const holidayInfo = getHolidayInfo(dateISO);

                        const cellBg = isToday
                          ? 'bg-white/15'
                          : holidayInfo?.holidayType === 'storhelg'
                          ? 'bg-red-900/25'
                          : holidayInfo?.holidayType === 'småhelg'
                          ? 'bg-amber-900/20'
                          : (holidayInfo !== null && holidayInfo.effectiveDayType === 'fredag')
                          ? 'bg-violet-900/15'
                          : '';
                        const cellBorderColor = isException
                          ? 'border-amber-300/60'
                          : holidayInfo?.holidayType === 'storhelg'
                          ? 'border-red-400/50'
                          : holidayInfo?.holidayType === 'småhelg'
                          ? 'border-amber-400/40'
                          : 'border-white/10';

                        return (
                          <button
                            key={date.toISOString()}
                            type="button"
                            onClick={() => openDateModal(date)}
                            aria-disabled={!selectedBoat}
                            className={[
                              `relative h-24 border ${cellBorderColor} px-2 py-2 text-left text-sm transition-colors`,
                              selectedBoat ? 'hover:bg-white/15' : 'cursor-not-allowed opacity-70',
                              inCurrentMonth ? 'text-[#F5F7FF]' : 'text-[#F5F7FF]/45',
                              cellBg,
                              isToday ? 'font-semibold' : '',
                              anyActive ? 'ring-1 ring-inset ring-green-400/50' : '',
                            ].join(' ')}
                          >
                            {shiftHours.length > 0 && (
                              <div className="absolute right-0 top-0 flex flex-col">
                                {shiftHours.map((_, i) => {
                                  const key = shiftKey(dateISO, i);
                                  const active = activeShifts.has(key);
                                  return (
                                    <span
                                      key={i}
                                      role="button"
                                      aria-label={active ? 'Avmarkera' : 'Markera'}
                                      onClick={(e) => { e.stopPropagation(); toggleShift(key); }}
                                      className={[
                                        'flex h-6 w-6 items-center justify-center rounded-bl-lg transition-colors',
                                        active ? 'bg-green-400/20' : 'bg-white/5 hover:bg-white/10',
                                      ].join(' ')}
                                    >
                                      <span className={[
                                        'h-2.5 w-2.5 rounded-full transition-colors',
                                        active ? 'bg-green-400' : 'bg-purple-400/60',
                                      ].join(' ')} />
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center gap-0.5 flex-wrap">
                              <span className="text-base font-medium">{format(date, 'd')}</span>
                              {isException && (
                                <span className="rounded bg-amber-200/30 px-1 text-[10px] text-amber-100">Avv</span>
                              )}
                              {holidayInfo?.holidayType === 'storhelg' && (
                                <span className="rounded bg-red-500/30 px-1 text-[9px] leading-tight text-red-200">OB</span>
                              )}
                              {holidayInfo?.holidayType === 'småhelg' && (
                                <span className="rounded bg-amber-500/25 px-1 text-[9px] leading-tight text-amber-200">sh</span>
                              )}
                              {holidayInfo !== null && holidayInfo.holidayType === null && (
                                <span className="rounded bg-violet-500/25 px-1 text-[9px] leading-tight text-violet-200">OB</span>
                              )}
                            </div>
                            {shiftHours.length > 0 && (
                              <div className="mt-0.5 flex flex-col gap-0.5">
                                {shiftHours.map((h, i) => {
                                  const active = activeShifts.has(shiftKey(dateISO, i));
                                  return (
                                    <span key={i} className={['text-[13px] font-semibold leading-none transition-colors', active ? 'text-green-300' : 'text-sky-300/50'].join(' ')}>
                                      {h.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h{' '}
                                      <span className="text-[10px] font-normal opacity-70">avt.</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {(activeShifts.size > 0 || savedShiftCount > 0) && (() => {
        const totalPass = savedShiftCount + activeShifts.size;
        const totalHours = savedHours + totalActiveHours;
        const maskinDagar = maskinDagarOverride ?? totalPass;
        const maskinRate = allowanceAmounts['maskinskots'];
        const maskinSum = maskinDagar * maskinRate;

        let totalNormalOT = 0;
        let totalFredagOT = 0;
        let totalQualOT = 0;
        for (const [iso, h] of Object.entries(overtimeByDate)) {
          if (!h) continue;
          const eff = getEffectiveAoDayType(iso);
          if (eff === 'söndag' || eff === 'lördag') totalQualOT += h;
          else if (eff === 'fredag') totalFredagOT += h;
          else totalNormalOT += h;
        }
        return (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-[-0.02em]">Summering</h3>
              {savedShiftCount > 0 && (
                <button type="button" onClick={clearSaved}
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-[#F5F7FF]/60 hover:bg-white/10">
                  Rensa sparade
                </button>
              )}
            </div>

            <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">

              {/* Tid enl. avtal */}
              <div className="flex items-center gap-4 bg-green-400/8 px-4 py-3">
                <div className="flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-green-300/60">Tid enl. avtal</div>
                  <div className="mt-0.5 text-2xl font-bold text-green-300">
                    {totalHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h
                  </div>
                  {savedHours > 0 && totalActiveHours > 0 && (
                    <div className="text-[11px] text-green-300/40">
                      {savedHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h sparade + {totalActiveHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h nu
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#F5F7FF]">{totalPass}</div>
                  <div className="text-[11px] text-[#F5F7FF]/40">pass</div>
                  {savedShiftCount > 0 && activeShifts.size > 0 && (
                    <div className="mt-0.5 text-[10px] text-[#F5F7FF]/25">{savedShiftCount}+{activeShifts.size}</div>
                  )}
                </div>
              </div>

            </div>

            {/* Tillägg & övertid */}
            <div className="mt-3 divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">

              {/* Grundlön */}
              {(() => {
                const tenure = groundSalarySelection.tenure;
                const tenureDisplay = tenure === 'beg' ? 0 : parseInt(tenure.slice(1), 10);
                const salaryValue = selectedTariff[groundSalarySelection.employmentType][tenure];
                const unit = groundSalarySelection.employmentType === 'monthly' ? 'kr/mån' : 'kr/tim';
                const typeLabel = groundSalarySelection.employmentType === 'monthly' ? 'Månadslön' : groundSalarySelection.employmentType === 'hourlySeasonal' ? 'Timlön säsong' : 'Timlön korttid';
                return (
                  <div className="flex items-center gap-4 bg-white/5 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-[#F5F7FF]/40">Grundlön — {typeLabel}</div>
                      <div className="mt-0.5 text-2xl font-bold text-[#F5F7FF]">
                        {salaryValue.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-base font-normal text-[#F5F7FF]/60">{unit}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#F5F7FF]/70">{tenureDisplay}</div>
                      <div className="text-[11px] text-[#F5F7FF]/30">nivå</div>
                    </div>
                  </div>
                );
              })()}
              {activeAllowances.has('maskinskots') && (
                <div className="flex items-center gap-4 bg-amber-400/8 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-amber-300/60">Maskinskötstillägg</div>
                    <div className="mt-0.5 text-2xl font-bold text-amber-300">
                      {maskinSum.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </div>
                    <div className="text-[11px] text-amber-300/40">{maskinDagar} × {maskinRate} kr/dag</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={maskinDagar}
                        min={0}
                        onChange={(e) => setMaskinDagarOverride(Number(e.target.value))}
                        className="w-14 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-base font-bold text-amber-200 [appearance:textfield]"
                      />
                      {maskinDagarOverride !== null && (
                        <button type="button" onClick={() => setMaskinDagarOverride(null)}
                          className="text-sm text-amber-300/40 hover:text-amber-300" title="Återställ">↺</button>
                      )}
                    </div>
                    <div className="text-[11px] text-amber-300/40">dagar</div>
                  </div>
                </div>
              )}

              {/* Rederitillägg */}
              {activeAllowances.has('rederi') && (
                <div className="flex items-center gap-4 bg-sky-400/8 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-sky-300/60">Rederitillägg</div>
                    <div className="mt-0.5 text-2xl font-bold text-sky-300">
                      {allowanceAmounts['rederi'].toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-sky-300/40">/mån</div>
                  </div>
                </div>
              )}

              {/* Däckmanstillägg */}
              {activeAllowances.has('dackman') && (
                <div className="flex items-center gap-4 bg-violet-400/8 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-violet-300/60">Däckmanstillägg</div>
                    <div className="mt-0.5 text-2xl font-bold text-violet-300">
                      {allowanceAmounts['dackman'].toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-violet-300/40">/mån</div>
                  </div>
                </div>
              )}

              {/* Vanlig övertid */}
              {(totalNormalOT > 0 || true) && (
                <div className="flex items-center gap-4 bg-orange-400/8 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-orange-300/60">Vanlig övertid</div>
                    <div className="mt-0.5 text-2xl font-bold text-orange-300">
                      {(totalNormalOT * overtimeRateNormal).toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </div>
                    <div className="text-[11px] text-orange-300/40">
                      {totalNormalOT.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h × {overtimeRateNormal} kr/h
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={overtimeRateNormal}
                        min={0}
                        onChange={(e) => setOvertimeRateNormal(Number(e.target.value))}
                        className="w-20 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-base font-bold text-orange-200 [appearance:textfield]"
                      />
                    </div>
                    <div className="text-[11px] text-orange-300/40">kr/h</div>
                  </div>
                </div>
              )}

              {/* Fredag-OB */}
              {(totalFredagOT > 0 || true) && (
                <div className="flex items-center gap-4 bg-violet-400/8 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-violet-300/60">Fredag-OB</div>
                    <div className="mt-0.5 text-2xl font-bold text-violet-300">
                      {(totalFredagOT * overtimeRateFredag).toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </div>
                    <div className="text-[11px] text-violet-300/40">
                      {totalFredagOT.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h × {overtimeRateFredag} kr/h
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={overtimeRateFredag}
                        min={0}
                        onChange={(e) => setOvertimeRateFredag(Number(e.target.value))}
                        className="w-20 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-base font-bold text-violet-200 [appearance:textfield]"
                      />
                    </div>
                    <div className="text-[11px] text-violet-300/40">kr/h</div>
                  </div>
                </div>
              )}

              {/* Kvalificerad övertid */}
              {(totalQualOT > 0 || true) && (
                <div className="flex items-center gap-4 bg-rose-400/8 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-rose-300/60">Kvalificerad övertid (lör/sön/storhelg)</div>
                    <div className="mt-0.5 text-2xl font-bold text-rose-300">
                      {(totalQualOT * overtimeRateQual).toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                    </div>
                    <div className="text-[11px] text-rose-300/40">
                      {totalQualOT.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h × {overtimeRateQual} kr/h
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={overtimeRateQual}
                        min={0}
                        onChange={(e) => setOvertimeRateQual(Number(e.target.value))}
                        className="w-20 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-base font-bold text-rose-200 [appearance:textfield]"
                      />
                    </div>
                    <div className="text-[11px] text-rose-300/40">kr/h</div>
                  </div>
                </div>
              )}

            </div>
          </section>
        );
      })()}

      <DayModal
        isOpen={isModalOpen}
        dateISO={selectedDateISO}
        resolvedDay={selectedResolvedDay}
        tidEnlKollAvt={selectedDayTidEnl}
        overtime={selectedDateISO ? (overtimeByDate[selectedDateISO] ?? 0) : 0}
        onOvertimeChange={(h) => {
          if (!selectedDateISO) return;
          setOvertimeByDate((prev) => ({ ...prev, [selectedDateISO]: h }));
        }}
        onClose={() => setIsModalOpen(false)}
      />

      {showSavePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-white/15 bg-[#0B1B3A] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <h4 className="mb-2 text-base font-semibold">Byt båt</h4>
            <p className="mb-5 text-sm text-[#F5F7FF]/70">
              Du har markerade pass ({activeShifts.size} st, {totalActiveHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h). Vill du spara tiderna innan du byter båt?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => confirmSave(true)}
                className="flex-1 rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-400"
              >
                Ja, spara
              </button>
              <button
                type="button"
                onClick={() => confirmSave(false)}
                className="flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
              >
                Nej
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-white/15 bg-[#0B1B3A] px-4 py-3 text-sm text-[#F5F7FF] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          {toastMessage}
        </div>
      )}
    </>
  );
}
