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
import { useAppContext, ALLOWANCES } from '@/components/AppContext';
import { TENURE_KEYS } from '@/lib/tariffs/types';
import {
  getMonthGridDates,
  isSameMonth,
  normalizeDateISO,
} from '@/lib/calendar/helpers';
import { resolveAoDay, calcTidEnlKollAvtHours, calcTidEnlPerShift } from '@/lib/ao/resolveAoDay';
import { getLocalAoSheets, listLocalAoSheets, mergeAoSheetLists } from '@/lib/ao/clientStore';
import { buildTraktamenteRows } from '@/lib/traktamente/buildTraktamenteRows';
import { downloadTraktamentePdf } from '@/lib/traktamente/traktamentePdf';
import type { SavedMonth } from '@/components/AppContext';
import {
  boatLabel,
  editionStartsInMonth,
  editionsForMonth,
  periodLabel,
  pickEditionForDate,
} from '@/lib/ao/editions';
import { getHolidayInfo, getEffectiveAoDayType } from '@/lib/ao/holidayRules';
import { calculateMonthlySalary } from '@/lib/salary/calculateMonthlySalary';
import type { DaySalaryInput } from '@/lib/salary/calculateMonthlySalary';
import type { AoMode, ParsedAoSheet, StoredAoSheetMeta } from '@/lib/ao/types';
import type { BoatOption, ResolvedDaySchedule } from '@/lib/schedule/types';

const WEEKDAY_LABELS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

/** Stabil referens så att memo-beroenden inte ändras varje rendering. */
const EMPTY_SHEETS: ParsedAoSheet[] = [];

/** Löser en dag mot rätt utgåva bland en båts AO-blad. */
function resolveDayFromSheets(
  sheets: ParsedAoSheet[],
  mode: AoMode,
  dateISO: string,
): ResolvedDaySchedule {
  const sheet = pickEditionForDate(sheets, dateISO);
  if (!sheet) return { dateISO, shifts: [], isStandard: true, notes: [], flags: [] };
  // Utgåvor utan is-variant körs alltid som isfri — annars blir deras dagar
  // tomma när is-läge valts för en annan utgåva i samma månad.
  return resolveAoDay(sheet, sheet.hasIsVariant ? mode : 'isfri', dateISO);
}

/**
 * Jämför en dags arbetade timmar (lönespec + ev. plustid) mot AO-schemat.
 * Används både vid lönespec-import och när en dags båt byts, så att samma
 * regler gäller — bara AO-tiden som jämförs mot skiljer sig.
 */
function matchDayAgainstAo(resolved: ResolvedDaySchedule, totalWorked: number) {
  const perShift = calcTidEnlPerShift(resolved);
  return {
    perShift,
    aoHours: calcTidEnlKollAvtHours(resolved) ?? 0,
    matched: findMatchingShifts(perShift, totalWorked),
  };
}

/** Datumen från och med ett datum till månadens sista dag. */
function datesToMonthEnd(fromISO: string): string[] {
  const year = Number(fromISO.slice(0, 4));
  const month = Number(fromISO.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();
  const out: string[] = [];
  for (let d = Number(fromISO.slice(8, 10)); d <= lastDay; d++) {
    out.push(`${fromISO.slice(0, 8)}${String(d).padStart(2, '0')}`);
  }
  return out;
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Timmar med upp till två decimaler (AO kan vara minutexakt, t.ex. 10,25). */
function fmtHours(value: number): string {
  return value.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/** Lönespec-timmar — alltid två decimaler, som på specen (t.ex. 8,42). */
function fmtPayslipHours(value: number): string {
  return value.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Kort befattningsetikett från AO:ns "Befattning"-rad, t.ex. "Matros/jungman"
 * → Däck, "Buffist" → Café. Viktig när både däck- och café-AO finns för
 * samma båt och period — visar vilken variant som är aktiv.
 */
function roleLabel(roles: string | null): string | null {
  if (!roles) return null;
  const lower = roles.toLowerCase();
  // Däck-orden kollas först — kombinerade befattningar som
  // "Matros/jungman/jungman-cafe" är däcks-AO, inte café.
  if (lower.includes('matros') || lower.includes('jungman') || lower.includes('däck')) return 'Däck';
  if (lower.includes('buffist') || lower.includes('kafé') || lower.includes('cafe')) return 'Café';
  return null;
}

/**
 * Hittar den delmängd av dagens AO-pass vars summerade timmar matchar
 * lönespecens timmar för dagen. Delmängder med färre pass prövas först så
 * att ett ensamt pass vinner över kombinationer.
 *
 * Tolerans 0,03 h (~2 min): lönespecen anger timmar med två decimaler och
 * AO-tider är minutexakta, så endast avrundningsskillnader ska tillåtas —
 * verkliga avvikelser (kontoret har bokfört annan tid) ska flaggas.
 * Returnerar passindex eller null om inget stämmer.
 */
function findMatchingShifts(perShift: number[], payslipHours: number): number[] | null {
  const n = perShift.length;
  if (n === 0 || n > 6) return null;

  const masks = Array.from({ length: (1 << n) - 1 }, (_, k) => k + 1);
  const popcount = (m: number) => {
    let c = 0;
    while (m) { c += m & 1; m >>= 1; }
    return c;
  };
  masks.sort((a, b) => popcount(a) - popcount(b));

  for (const mask of masks) {
    let sum = 0;
    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += perShift[i];
        indices.push(i);
      }
    }
    if (Math.abs(sum - payslipHours) <= 0.03) return indices;
  }
  return null;
}

export function WorkCalendar({ refreshKey = 0 }: { refreshKey?: number }) {
  const { selectedCalendarYear, setSelectedCalendarYear, selectedTariffDate, activeAllowances, allowanceAmounts, groundSalarySelection, selectedTariff, saveMonth, loadMonth, loadPayslip, listPayslipsForMonth, listSavedMonths, knownNatthamnar, rememberNatthamn } =
    useAppContext();

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
  // Flera säsonger kan gälla samtidigt (vinter, vår/höst, sommar) — utgåva
  // väljs per dag, se lib/ao/editions.ts. Kartan rymmer flera båtar eftersom
  // enskilda dagar kan ha en annan båt än månadens (boatByDate).
  const [sheetsByBoat, setSheetsByBoat] = React.useState<Record<string, ParsedAoSheet[]>>({});
  const [loadingSheet, setLoadingSheet] = React.useState(false);
  // båt per dag när dagen avviker från månadens båt
  const [boatByDate, setBoatByDate] = React.useState<Record<string, string>>({});

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
  // övertid per datum
  const [overtimeByDate, setOvertimeByDate] = React.useState<Record<string, number>>({});
  // manuell ordinarie tid per datum
  const [manualHoursByDate, setManualHoursByDate] = React.useState<Record<string, number>>({});
  // avvikelser från lönespec-import (per datum)
  const [payslipDeviations, setPayslipDeviations] = React.useState<Record<string, { payslipH: number; aoH: number }>>({});
  // dagar där lönespec och AO stämmer överens (per datum)
  const [payslipConfirmed, setPayslipConfirmed] = React.useState<Record<string, boolean>>({});
  // komp-övertid (art311/312 från lönespec)
  const [kompHoursWeekday, setKompHoursWeekday] = React.useState(0);
  const [kompHoursWeekend, setKompHoursWeekend] = React.useState(0);
  // laborera: ta ut komp-övertiden kontant (ingår då i bruttolönen)
  const [kompPayout, setKompPayout] = React.useState(false);
  // sjukdagar (art80001)
  const [sjukByDate, setSjukByDate] = React.useState<Record<string, number>>({});
  // semesterdagar (art700)
  const [semesterByDate, setSemesterByDate] = React.useState<Record<string, boolean>>({});
  // aktiva dagar utan AO-pass (import utan AO)
  const [manualActiveDates, setManualActiveDates] = React.useState<Set<string>>(new Set());
  // datum med maskinskötseltillägg (art2101 från lönespec)
  const [maskinByDate, setMaskinByDate] = React.useState<Set<string>>(new Set());
  // plustid per datum (art483 — tid över årsarbetstidstaket; ordinarie tid
  // klipps på specen den dagen, verklig arbetstid = art315 + art483)
  const [plusByDate, setPlusByDate] = React.useState<Record<string, number>>({});
  // VAB (art810) — timmar per dag, fördelade mot AO-tiden, samt specens
  // löneavdrag (art81001) och den arbetade tiden dagen gäller
  const [vabByDate, setVabByDate] = React.useState<Record<string, number>>({});
  const [vabSekByDate, setVabSekByDate] = React.useState<Record<string, number>>({});
  const [arbetadByDate, setArbetadByDate] = React.useState<Record<string, number>>({});
  // obetalt traktamente (övernattning ombord) — markeras manuellt per dag
  const [traktamenteDates, setTraktamenteDates] = React.useState<Set<string>>(new Set());
  const [natthamnByDate, setNatthamnByDate] = React.useState<Record<string, string>>({});
  // Månaden som nuvarande state faktiskt hör till. Sätts när månadsdatan
  // laddats, så att auto-sparningen inte hinner skriva förra månadens data
  // på den nya månaden i renderingen då månaden precis bytts.
  const [loadedMonth, setLoadedMonth] = React.useState('');



  React.useEffect(() => {
    const yearFromMonth = currentMonth.getFullYear();
    if (yearFromMonth !== selectedCalendarYear) {
      setSelectedCalendarYear(yearFromMonth);
    }
  }, [currentMonth, selectedCalendarYear, setSelectedCalendarYear]);

  // ���� Ladda båtlista från storage/ao/ ����������������������������������������������������������������������������
  React.useEffect(() => {
    let canceled = false;

    const toBoats = (sheets: StoredAoSheetMeta[]): BoatOption[] =>
      sheets.map((s) => ({
        value: s.slug,
        label: boatLabel(s.vesselName ?? s.sheetName),
      }));

    // Lokalt sparade AO:n visas direkt; server-listan (lokal dev) mergas in.
    const localSheets = listLocalAoSheets();
    setAvailableBoats(toBoats(mergeAoSheetLists([], localSheets)));

    fetch('/api/ao/sheets')
      .then((r) => r.json())
      .then((data: { success: boolean; sheets?: StoredAoSheetMeta[] }) => {
        if (canceled || !data.success) return;
        setAvailableBoats(toBoats(mergeAoSheetLists(data.sheets ?? [], localSheets)));
      })
      .catch(() => {
        // Behåll den lokala listan om servern inte svarar
      });

    return () => { canceled = true; };
  }, [boatListKey, refreshKey]);

  // ���� Ladda AO-data när båt väljs ��������������������������������������������������������������������������������������
  React.useEffect(() => {
    let canceled = false;

    if (!selectedBoat) return;

    // Lokalt sparade AO:n har företräde — serverns lagring är efemär på
    // Netlify. Alla utgåvor för båten laddas; rätt utgåva väljs sedan per dag.
    const localSheets = getLocalAoSheets(selectedBoat);
    if (localSheets.length > 0) {
      setSheetsByBoat((prev) => ({ ...prev, [selectedBoat]: localSheets }));
      setLoadingSheet(false);
      return;
    }

    setLoadingSheet(true);

    fetch(`/api/ao/sheets/${encodeURIComponent(selectedBoat)}`)
      .then((r) => r.json())
      .then((data: { success: boolean; sheet?: ParsedAoSheet }) => {
        if (canceled) return;
        setSheetsByBoat((prev) => ({
          ...prev,
          [selectedBoat]: data.success && data.sheet ? [data.sheet] : [],
        }));
      })
      .catch(() => {
        if (!canceled) setSheetsByBoat((prev) => ({ ...prev, [selectedBoat]: [] }));
      })
      .finally(() => {
        if (!canceled) setLoadingSheet(false);
      });

    return () => { canceled = true; };
  }, [selectedBoat, boatListKey, refreshKey]);

  // Ladda AO-utgåvor för båtar som satts på enskilda dagar. Måste ske i en
  // effekt — localStorage-läsning under rendering ger hydration-mismatch.
  React.useEffect(() => {
    const missing = Array.from(new Set(Object.values(boatByDate))).filter(
      (slug) => slug && !sheetsByBoat[slug],
    );
    if (missing.length === 0) return;

    let canceled = false;
    const loaded: Record<string, ParsedAoSheet[]> = {};
    const pending: Promise<void>[] = [];

    for (const slug of missing) {
      const local = getLocalAoSheets(slug);
      if (local.length > 0) {
        loaded[slug] = local;
        continue;
      }
      pending.push(
        fetch(`/api/ao/sheets/${encodeURIComponent(slug)}`)
          .then((r) => r.json())
          .then((data: { success: boolean; sheet?: ParsedAoSheet }) => {
            loaded[slug] = data.success && data.sheet ? [data.sheet] : [];
          })
          .catch(() => {
            loaded[slug] = [];
          }),
      );
    }

    Promise.all(pending).then(() => {
      if (!canceled) setSheetsByBoat((prev) => ({ ...loaded, ...prev }));
    });

    return () => { canceled = true; };
  }, [boatByDate, sheetsByBoat]);

  const aoSheets = React.useMemo(
    () => sheetsByBoat[selectedBoat] ?? EMPTY_SHEETS,
    [sheetsByBoat, selectedBoat],
  );

  const showToast = React.useCallback((message: string, durationMs = 2500) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, durationMs);
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

  // AO-utgåvor som berör den visade månaden (kan vara flera vid säsongsbyte)
  const monthEditions = React.useMemo(
    () => editionsForMonth(aoSheets, monthISO),
    [aoSheets, monthISO],
  );

  // Dagar där en ny utgåva börjar gälla — underlag för "Ny AO"-noteringen
  const editionStarts = React.useMemo(
    () => editionStartsInMonth(aoSheets, monthISO),
    [aoSheets, monthISO],
  );

  const monthHasIsVariant = monthEditions.some((s) => s.hasIsVariant);

  // AO-raden ovanför kalendern visar utgåvan som gäller månadens första dag
  const headerEdition =
    pickEditionForDate(aoSheets, `${monthISO}-01`) ?? monthEditions[0] ?? null;

  /**
   * Löser en dag mot den AO-utgåva som gäller just det datumet.
   * Utgåvor utan is-variant körs alltid som "isfri" — annars skulle deras
   * dagar bli tomma när användaren valt is-läge för en annan utgåva i
   * samma månad (t.ex. vår/höst 1–11 dec + vinter från 13 dec).
   */
  /** Båten som gäller ett visst datum — dagens egen om den satts, annars månadens. */
  const boatForDate = React.useCallback(
    (dateISO: string) => boatByDate[dateISO] || selectedBoat,
    [boatByDate, selectedBoat],
  );

  const resolveDay = React.useCallback(
    (dateISO: string): ResolvedDaySchedule =>
      resolveDayFromSheets(
        sheetsByBoat[boatForDate(dateISO)] ?? EMPTY_SHEETS,
        selectedMode,
        dateISO,
      ),
    [sheetsByBoat, boatForDate, selectedMode],
  );

  /** Visningsnamn för dagens båt — används i tooltipen på AO-tiden. */
  const boatNameForDate = React.useCallback(
    (dateISO: string) => {
      const slug = boatForDate(dateISO);
      const sheet = pickEditionForDate(sheetsByBoat[slug] ?? EMPTY_SHEETS, dateISO);
      if (sheet) return boatLabel(sheet.vesselName ?? sheet.sheetName);
      return availableBoats.find((b) => b.value === slug)?.label ?? '';
    },
    [boatForDate, sheetsByBoat, availableBoats],
  );

  // Återställ till isfri automatiskt om ingen utgåva i månaden har is-variant
  React.useEffect(() => {
    if (monthEditions.length > 0 && !monthHasIsVariant) {
      setSelectedMode('isfri');
    }
  }, [monthEditions.length, monthHasIsVariant]);

  // Auto-ladda månadsdata när månaden ändras.
  // Saknas sparad månad nollställs allt — annars ligger förra månadens pass,
  // markeringar och timmar kvar i state och skrivs in på den nya månaden.
  // Båt och isläge behålls, de är användarens val och inte månadsdata.
  React.useEffect(() => {
    const saved = loadMonth(monthISO);
    if (saved?.boatSlug && saved.boatSlug !== selectedBoat) {
      setSelectedBoat(saved.boatSlug);
    }
    if (saved?.mode) setSelectedMode(saved.mode as AoMode);
    setActiveShifts(new Set(saved?.activeShifts ?? []));
    setManualHoursByDate(saved?.manualHoursByDate ?? {});
    setOvertimeByDate(saved?.overtimeByDate ?? {});
    setKompHoursWeekday(saved?.kompHoursWeekday ?? 0);
    setKompHoursWeekend(saved?.kompHoursWeekend ?? 0);
    setSjukByDate(saved?.sjukByDate ?? {});
    setSemesterByDate(saved?.semesterByDate ?? {});
    setManualActiveDates(new Set(saved?.manualActiveDates ?? []));
    setMaskinByDate(new Set(saved?.maskinDates ?? []));
    setPlusByDate(saved?.plusByDate ?? {});
    setTraktamenteDates(new Set(saved?.traktamenteDates ?? []));
    setNatthamnByDate(saved?.natthamnByDate ?? {});
    setBoatByDate(saved?.boatByDate ?? {});
    setVabByDate(saved?.vabByDate ?? {});
    setVabSekByDate(saved?.vabSekByDate ?? {});
    setArbetadByDate(saved?.arbetadByDate ?? {});
    setKompPayout(saved?.kompPayout ?? false);
    setLoadedMonth(monthISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthISO]);

  // Auto-spara månadsdata när state ändras
  React.useEffect(() => {
    // State hör ännu till förra månaden — vänta tills månadsdatan laddats
    if (loadedMonth !== monthISO) return;
    if (activeShifts.size === 0 &&
        Object.keys(manualHoursByDate).length === 0 &&
        Object.keys(overtimeByDate).length === 0 &&
        Object.keys(sjukByDate).length === 0 &&
        Object.keys(semesterByDate).length === 0 &&
        manualActiveDates.size === 0 &&
        maskinByDate.size === 0 &&
        Object.keys(plusByDate).length === 0 &&
        traktamenteDates.size === 0 &&
        Object.keys(boatByDate).length === 0 &&
        Object.keys(vabByDate).length === 0 &&
        kompHoursWeekday === 0 && kompHoursWeekend === 0) return;
    saveMonth({
      monthISO,
      boatSlug: selectedBoat,
      mode: selectedMode,
      activeShifts: Array.from(activeShifts),
      manualHoursByDate,
      overtimeByDate,
      kompHoursWeekday,
      kompHoursWeekend,
      kompPayout,
      sjukByDate,
      semesterByDate,
      manualActiveDates: Array.from(manualActiveDates),
      maskinDates: Array.from(maskinByDate),
      plusByDate,
      traktamenteDates: Array.from(traktamenteDates),
      natthamnByDate,
      boatByDate,
      vabByDate,
      vabSekByDate,
      arbetadByDate,
      savedAt: new Date().toISOString(),
    });
  }, [activeShifts, manualHoursByDate, overtimeByDate, sjukByDate, semesterByDate, manualActiveDates, maskinByDate, plusByDate, traktamenteDates, natthamnByDate, boatByDate, vabByDate, vabSekByDate, arbetadByDate, kompHoursWeekday, kompHoursWeekend, kompPayout, selectedBoat, selectedMode, monthISO, loadedMonth, saveMonth]);

  const selectedDayTidEnl = React.useMemo(
    () => (selectedResolvedDay ? calcTidEnlKollAvtHours(selectedResolvedDay) : null),
    [selectedResolvedDay],
  );

  const totalActiveHours = React.useMemo(() => {
    if (aoSheets.length === 0 || activeShifts.size === 0) return 0;
    let total = 0;
    const hoursByDate = new Map<string, number[]>();
    for (const key of activeShifts) {
      const sepIdx = key.lastIndexOf('::');
      const iso = key.slice(0, sepIdx);
      const idx = Number(key.slice(sepIdx + 2));
      if (!hoursByDate.has(iso)) {
        hoursByDate.set(iso, calcTidEnlPerShift(resolveDay(iso)));
      }
      total += hoursByDate.get(iso)![idx] ?? 0;
    }
    return total;
  }, [activeShifts, aoSheets, resolveDay]);

  // Beräkna lön automatiskt från tariffen
  const salaryBreakdown = React.useMemo(() => {
    const days: DaySalaryInput[] = [];

    // Maskinskötseltillägg: när specifika dagar finns markerade (från lönespec
    // eller manuellt i dagmodalen) styr de exakt vilka dagar som räknas.
    // Annars gäller inställningen i Löneinställningar för alla aktiva dagar.
    const maskinExplicit = maskinByDate.size > 0;
    const maskinDay = (iso: string) =>
      maskinExplicit
        ? (maskinByDate.has(iso) ? 1 : 0)
        : (activeAllowances.has('maskinskots') ? 1 : 0);

    // Aktiva pass från AO
    for (const key of activeShifts) {
      const sepIdx = key.lastIndexOf('::');
      const iso = key.slice(0, sepIdx);
      const shiftIdx = Number(key.slice(sepIdx + 2));
      const resolved = resolveDay(iso);
      const aoHrs = calcTidEnlPerShift(resolved)[shiftIdx] ?? 0;

      // Hämta klockslag för detta pass för exakt OB-beräkning
      const shiftData = resolved.shifts[shiftIdx];
      const shiftSpan = shiftData?.work?.start && shiftData?.work?.end
        ? { start: shiftData.work.start, end: shiftData.work.end }
        : null;

      const existing = days.find((d) => d.dateISO === iso);
      if (existing) {
        existing.aoHours += aoHrs;
        if (shiftSpan) existing.shifts.push(shiftSpan);
      } else {
        days.push({
          dateISO: iso,
          aoHours: aoHrs,
          manualHours: manualHoursByDate[iso] ?? 0,
          shifts: shiftSpan ? [shiftSpan] : [],
          overtimeHours: overtimeByDate[iso] ?? 0,
          engineAttendantDays: maskinDay(iso),
        });
      }
    }

    // Sparade timmar — lägg till som generiska dagar utan datum
    // (savedHours har inget per-datum-state ännu, räknas som vardag)

    // Manuella dagar utan AO-pass
    for (const [iso, hrs] of Object.entries(manualHoursByDate)) {
      if (hrs > 0 && !days.find((d) => d.dateISO === iso)) {
        days.push({
          dateISO: iso,
          aoHours: 0,
          manualHours: hrs,
          shifts: [], // Inga klockslag — OB beräknas på dagtyp
          overtimeHours: overtimeByDate[iso] ?? 0,
          engineAttendantDays: maskinDay(iso),
        });
      }
    }

    // Manuellt aktiva dagar (import utan AO) som inte redan finns
    for (const iso of manualActiveDates) {
      if (!days.find((d) => d.dateISO === iso)) {
        days.push({
          dateISO: iso,
          aoHours: 0,
          manualHours: manualHoursByDate[iso] ?? 0,
          shifts: [],
          overtimeHours: overtimeByDate[iso] ?? 0,
          engineAttendantDays: maskinDay(iso),
        });
      }
    }

    // Maskindagar som inte sammanfaller med någon aktiv dag (t.ex. manuellt
    // markerade i modalen) ska ändå ge tillägg
    if (maskinExplicit) {
      for (const iso of maskinByDate) {
        if (!days.find((d) => d.dateISO === iso)) {
          days.push({
            dateISO: iso,
            aoHours: 0,
            manualHours: 0,
            shifts: [],
            overtimeHours: 0,
            engineAttendantDays: 1,
          });
        }
      }
    }

    if (days.length === 0) return null;

    return calculateMonthlySalary({
      tariff: selectedTariff,
      tenure: groundSalarySelection.tenure,
      employmentType: groundSalarySelection.employmentType,
      days,
      activeAllowances,
      allowanceAmounts,
    });
  }, [activeShifts, manualHoursByDate, overtimeByDate, manualActiveDates, maskinByDate, resolveDay,
      selectedTariff, groundSalarySelection, activeAllowances, allowanceAmounts]);

  function resolveForDate(dateISO: string): ResolvedDaySchedule {
    return resolveDay(dateISO);
  }

  function shiftKey(dateISO: string, idx: number) {
    return `${dateISO}::${idx}`;
  }

  /**
   * Växlar en dag som saknar AO-pass mellan markerad och omarkerad.
   * Importen räknar aldrig sådana dagar som vanlig arbetstid — det här är
   * användarens egen markering när hen ändå vill ha med timmarna.
   */
  function toggleDayWithoutAo(dateISO: string, hours: number) {
    const wasActive = manualActiveDates.has(dateISO);
    setManualActiveDates((prev) => {
      const next = new Set(prev);
      if (wasActive) next.delete(dateISO);
      else next.add(dateISO);
      return next;
    });
    setManualHoursByDate((prev) => {
      const next = { ...prev };
      if (wasActive) delete next[dateISO];
      else next[dateISO] = hours;
      return next;
    });
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
      const r = resolveDay(iso);
      if (r.shifts.length > 0) {
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

  // ── Importera lönespec till kalender ────────────────────────────────────────

  // Börjar tom och fylls av effekten nedan — att läsa localStorage direkt i
  // initialvärdet ger hydration-mismatch när månaden har en sparad lönespec.
  const [currentPayslip, setCurrentPayslip] = React.useState<
    import('@/components/AppContext').SavedPayslip | null
  >(null);
  const [payslipPickerList, setPayslipPickerList] = React.useState<import('@/components/AppContext').SavedPayslip[] | null>(null);

  // Uppdatera när månad ändras eller localStorage ändras från annan flik/komponent
  React.useEffect(() => {
    setCurrentPayslip(loadPayslip(monthISO));

    function onStorage(e: StorageEvent) {
      if (e.key?.startsWith(`loneberakning:payslip:${monthISO}`)) {
        setCurrentPayslip(loadPayslip(monthISO));
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [monthISO, loadPayslip]);

  // Återställ avvikelser och kör AO-täckningskontroll när båt byts
  React.useEffect(() => {
    setPayslipDeviations({});
    setPayslipConfirmed({});

    if (aoSheets.length > 0 && monthEditions.length === 0 && currentPayslip) {
      const [y, m] = monthISO.split('-');
      const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('sv-SE', { month: 'long' });
      const rangeLabel = aoSheets.map((s) => periodLabel(s)).join(', ');
      showToast(`De uppladdade AO-schemana gäller ${rangeLabel} och täcker inte ${monthName}.`, 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoSheets]);

  function importPayslip() {
    const ps = loadPayslip(monthISO);
    if (!ps) return;
    const ov = ps.overview;
    const newDeviations: Record<string, { payslipH: number; aoH: number }> = {};
    const newConfirmed: Record<string, boolean> = {};

    // Semesterdagar (art700) — bygg set först så vi kan hoppa över avvikelsecheck
    const semesterDates = new Set<string>();
    const newSemester: Record<string, boolean> = {};
    const semManual = { ...manualHoursByDate };
    for (const iso of ov.art700?.datesISO ?? []) {
      semesterDates.add(iso);
      newSemester[iso] = true;
      semManual[iso] = 5;
    }
    setSemesterByDate(newSemester);

    // VAB (art810): specen anger flerdagarsintervall som en klumpsumma
    // ("2026-02-21 – 2026-02-23  29,83 Tim"). Fördela den proportionellt mot
    // dagens schemalagda tid — en hel VAB-dag motsvarar hela passet — så att
    // intervallets summa bevaras exakt. Utan tider fördelas timmarna jämnt.
    const specHours = ov.art315?.hoursByDateISO ?? {};
    const newVab: Record<string, number> = {};
    for (const range of ov.art810?.rangesISO ?? []) {
      const days: string[] = [];
      for (
        let d = new Date(`${range.from}T12:00:00`);
        normalizeDateISO(d) <= range.to;
        d.setDate(d.getDate() + 1)
      ) {
        days.push(normalizeDateISO(d));
      }
      if (days.length === 0) continue;

      // Vikta i första hand mot specens nominella tid för dagen (art315) —
      // den ligger kvar vid VAB och är det avdraget räknas på. Saknas den
      // används AO-tiden, annars jämn fördelning.
      const weights = days.map(
        (iso) => specHours[iso] ?? calcTidEnlKollAvtHours(resolveDay(iso)) ?? 0,
      );
      const weightSum = weights.reduce((s, h) => s + h, 0);
      days.forEach((iso, i) => {
        const share =
          weightSum > 0 ? (weights[i] / weightSum) * range.hours : range.hours / days.length;
        newVab[iso] = (newVab[iso] ?? 0) + share;
      });
    }
    // Fallback för specar utan intervall (äldre sparad data)
    if (Object.keys(newVab).length === 0) {
      for (const [iso, h] of Object.entries(ov.art810?.hoursByDateISO ?? {})) {
        newVab[iso] = h;
      }
    }
    setVabByDate(newVab);
    setVabSekByDate(ov.art81001?.sekByDateISO ?? {});

    // Plustid (art483): när årsarbetstidstaket (5 × månadens dagar) nås
    // klipps ordinarie tid (art315) den dagen och resten bokförs som plustid.
    // Verklig arbetstid för dagen = art315 + art483 — det är den summan som
    // ska jämföras mot AO.
    const newPlus = ov.art483?.hoursByDateISO ?? {};
    setPlusByDate(newPlus);

    // Ordinarie tid (art315) — och VAB-dagar, som kan sakna art315-rad helt
    const arbetadHours = ov.art315?.hoursByDateISO;
    if (arbetadHours || Object.keys(newVab).length > 0) {
      const newManual = { ...semManual };
      const newActiveShifts = new Set(activeShifts);
      const newManualActive = new Set(manualActiveDates);
      const newArbetad: Record<string, number> = {};

      const dagar = Array.from(
        new Set([...Object.keys(arbetadHours ?? {}), ...Object.keys(newVab)]),
      ).sort();

      for (const iso of dagar) {
        if (semesterDates.has(iso)) continue;

        // Art315 är nominell tid — den ligger kvar vid VAB och räknas in i
        // årsarbetstiden, så VAB-timmarna finns redan i summan mot AO.
        // Lägg tillbaka ev. klippt plustid så hela arbetstiden jämförs.
        const totalWorked = (arbetadHours?.[iso] ?? 0) + (newPlus[iso] ?? 0);
        if (totalWorked <= 0) continue;

        // Faktiskt arbetad tid = nominell tid minus frånvaron
        const arbetad = totalWorked - (newVab[iso] ?? 0);
        if (arbetad > 0.03) newArbetad[iso] = arbetad;

        // Lönespecens timmar är summan per dag. Vid på/avmönstring har AO
        // två pass samma dag — specen kan motsvara ena passet, andra passet
        // eller båda. Hitta den delmängd av passen vars summa stämmer.
        const { perShift, aoHours, matched: matchedShifts } = matchDayAgainstAo(
          resolveDay(iso),
          totalWorked,
        );

        // Saknar dagen AO-pass finns inget att jämföra mot — varken för att
        // ingen utgåva täcker datumet (glapp mellan säsonger) eller för att
        // utgåvan saknar schema just den dagen.
        if (perShift.length > 0) {
          if (matchedShifts) {
            for (const i of matchedShifts) {
              newActiveShifts.add(shiftKey(iso, i));
            }
            newConfirmed[iso] = true;
          } else {
            newDeviations[iso] = { payslipH: totalWorked, aoH: aoHours };
            newActiveShifts.add(shiftKey(iso, 0));
          }
          // Rensa ev. kvarliggande bokförd tid från tidigare import utan AO
          // — med AO laddat representeras dagen av sina pass.
          delete newManual[iso];
          newManualActive.delete(iso);
        } else {
          // AO saknar pass för dagen. Flagga det som ett fel och visa vad
          // specen säger — timmarna skrivs INTE in som vanlig arbetstid.
          // En dag utan AO ska egentligen vara övertid, och att tyst bokföra
          // den som ordinarie tid skulle dölja felet.
          newDeviations[iso] = { payslipH: totalWorked, aoH: 0 };
          delete newManual[iso];
          newManualActive.delete(iso);
        }
      }
      setActiveShifts(newActiveShifts);
      setManualActiveDates(newManualActive);
      setManualHoursByDate(newManual);
      setArbetadByDate(newArbetad);
      setPayslipDeviations(newDeviations);
      setPayslipConfirmed(newConfirmed);
    } else if (semesterDates.size > 0) {
      // Ingen art315 men vi har semesterdagar — sätt manuella timmar ändå
      setManualHoursByDate(semManual);
    }

    // Övertid (art301, art302 — utbetald övertid). Ersätter helt vid import
    // så att omimport inte dubblerar timmarna.
    const otArts = [ov.art301, ov.art302];
    const mergedOt: Record<string, number> = {};
    for (const art of otArts) {
      if (!art?.hoursByDateISO) continue;
      for (const [iso, hours] of Object.entries(art.hoursByDateISO)) {
        mergedOt[iso] = (mergedOt[iso] ?? 0) + hours;
      }
    }
    setOvertimeByDate(mergedOt);

    // Komp-övertid (art311 vardag, art312 helg) — sparas separat
    let kompWd = 0;
    let kompWe = 0;
    if (ov.art311?.hoursByDateISO) {
      for (const hours of Object.values(ov.art311.hoursByDateISO)) {
        kompWd += hours;
      }
    }
    if (ov.art312?.hoursByDateISO) {
      for (const hours of Object.values(ov.art312.hoursByDateISO)) {
        kompWe += hours;
      }
    }
    setKompHoursWeekday(kompWd);
    setKompHoursWeekend(kompWe);

    // Sjukdagar (art80001)
    const mergedSjuk: Record<string, number> = {};
    if (ov.art80001?.hoursByDateISO) {
      for (const [iso, hours] of Object.entries(ov.art80001.hoursByDateISO)) {
        if (hours > 0) mergedSjuk[iso] = hours;
      }
    }
    setSjukByDate(mergedSjuk);

    // Maskindagar (art2101) — markera dagarna i kalendern
    if (ov.art2101) {
      setMaskinByDate(new Set(ov.art2101.datesISO ?? []));
      const specDagar = ov.art2101.rowsCount;
      const calDagar = activeShifts.size;
      if (specDagar !== calDagar) {
        showToast(`Lönespec visar ${specDagar} maskindagar, kalendern visar ${calDagar} — kontrollera`);
      }
    } else {
      setMaskinByDate(new Set());
    }

    // AO saknas varning
    if (monthEditions.length === 0) {
      showToast(`Inget AO-schema är laddat för ${monthLabel}. Ladda upp AO för perioden om du vill jämföra mot schema.`);
    }

    if (Object.keys(newDeviations).length > 0) {
      showToast(`${Object.keys(newDeviations).length} dag(ar) avviker mellan lönespec och AO-schema`);
    }
  }

  /**
   * Sätter båt för en dag (eller resten av månaden) och kör om jämförelsen
   * mot den nya båtens AO-tid. Gamla markeringar tas bort — de avser den
   * förra båtens pass.
   */
  function applyDayBoat(slug: string, applyRestOfMonth: boolean) {
    if (!selectedDateISO) return;
    const dates = applyRestOfMonth ? datesToMonthEnd(selectedDateISO) : [selectedDateISO];
    const dateSet = new Set(dates);
    const effectiveSlug = slug || selectedBoat;

    // Utgåvorna behövs direkt för omkollen. Läsningen sker i en
    // händelsehanterare, inte under rendering, så den är hydration-säker.
    let sheets = sheetsByBoat[effectiveSlug];
    if (effectiveSlug && !sheets) {
      sheets = getLocalAoSheets(effectiveSlug);
      if (sheets.length > 0) {
        const loaded = sheets;
        setSheetsByBoat((prev) => ({ ...prev, [effectiveSlug]: loaded }));
      }
    }
    const daySheets = sheets ?? EMPTY_SHEETS;

    setBoatByDate((prev) => {
      const next = { ...prev };
      for (const iso of dates) {
        if (slug) next[iso] = slug;
        else delete next[iso];
      }
      return next;
    });

    // Markeringar och tidigare jämförelseresultat för dagarna nollställs
    setActiveShifts((prev) =>
      new Set(Array.from(prev).filter((k) => !dateSet.has(k.slice(0, k.lastIndexOf('::'))))),
    );
    const dropDates = (obj: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(obj).filter(([iso]) => !dateSet.has(iso)));

    const ps = loadPayslip(monthISO);
    const spec = ps?.overview.art315?.hoursByDateISO;
    const plus = ps?.overview.art483?.hoursByDateISO ?? {};
    const vabDates = new Set<string>([
      ...(ps?.overview.art810?.datesISO ?? []),
      ...(ps?.overview.art81001?.datesISO ?? []),
    ]);

    const newShiftKeys: string[] = [];
    const newDeviations: Record<string, { payslipH: number; aoH: number }> = {};
    const newConfirmed: Record<string, boolean> = {};

    if (spec) {
      for (const iso of dates) {
        if (semesterByDate[iso] || vabDates.has(iso)) continue;
        const hours = spec[iso];
        if (hours === undefined) continue;
        if (!pickEditionForDate(daySheets, iso)) continue;

        const totalWorked = hours + (plus[iso] ?? 0);
        const { perShift, aoHours, matched } = matchDayAgainstAo(
          resolveDayFromSheets(daySheets, selectedMode, iso),
          totalWorked,
        );

        if (matched) {
          for (const i of matched) newShiftKeys.push(shiftKey(iso, i));
          newConfirmed[iso] = true;
        } else {
          newDeviations[iso] = { payslipH: totalWorked, aoH: aoHours };
          if (perShift.length > 0) newShiftKeys.push(shiftKey(iso, 0));
        }
      }
    }

    setActiveShifts((prev) => new Set([...prev, ...newShiftKeys]));
    setPayslipDeviations((prev) => ({
      ...(dropDates(prev) as Record<string, { payslipH: number; aoH: number }>),
      ...newDeviations,
    }));
    setPayslipConfirmed((prev) => ({
      ...(dropDates(prev) as Record<string, boolean>),
      ...newConfirmed,
    }));

    // Modalen ska visa den nya båtens pass direkt
    setSelectedResolvedDay(resolveDayFromSheets(daySheets, selectedMode, selectedDateISO));
  }

  // ── Obetalt traktamente ─────────────────────────────────────────────────────

  /**
   * Sparade månader för året, där den visade månaden ersätts av aktuellt
   * state (auto-sparningen kan ligga ett renderingssteg efter).
   */
  function traktamenteMonths(): SavedMonth[] {
    const yearPrefix = String(currentYear);
    const months = listSavedMonths().filter((m) => m.monthISO.startsWith(yearPrefix));
    const current: SavedMonth = {
      ...(months.find((m) => m.monthISO === monthISO) ?? {
        monthISO,
        boatSlug: selectedBoat,
        mode: selectedMode,
        manualHoursByDate: {},
        overtimeByDate: {},
        kompHoursWeekday: 0,
        kompHoursWeekend: 0,
        sjukByDate: {},
        semesterByDate: {},
        savedAt: new Date().toISOString(),
        activeShifts: [],
      }),
      activeShifts: Array.from(activeShifts),
      boatSlug: selectedBoat,
      mode: selectedMode,
      traktamenteDates: Array.from(traktamenteDates),
      natthamnByDate,
    };
    if (!monthISO.startsWith(yearPrefix)) return months;
    return [...months.filter((m) => m.monthISO !== monthISO), current];
  }

  // Räknas fram efter mount, inte under renderingen — antalet bygger på
  // localStorage som servern inte har, och en render-tidsläsning skulle ge
  // hydration-mismatch (servern renderar utan knapp, klienten med).
  const [traktamenteYearCount, setTraktamenteYearCount] = React.useState(0);

  React.useEffect(() => {
    setTraktamenteYearCount(
      traktamenteMonths().reduce(
        (sum, m) =>
          sum + (m.traktamenteDates ?? []).filter((d) => d.startsWith(m.monthISO)).length,
        0,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, monthISO, traktamenteDates, natthamnByDate, selectedBoat]);

  async function downloadTraktamente() {
    const months = traktamenteMonths();
    const rows = buildTraktamenteRows(currentYear, months, loadPayslip);
    if (rows.length === 0) {
      showToast(`Inga dagar markerade för obetalt traktamente under ${currentYear}.`);
      return;
    }
    let employeeName: string | null = null;
    for (const m of months) {
      const name = loadPayslip(m.monthISO)?.employeeName;
      if (name) { employeeName = name; break; }
    }
    try {
      await downloadTraktamentePdf(currentYear, rows, employeeName);
    } catch {
      showToast('Kunde inte skapa PDF:en. Försök igen.', 4000);
    }
  }

  function loadAndSetPayslip(ps: import('@/components/AppContext').SavedPayslip) {
    setCurrentPayslip(ps);
    if (monthEditions.length > 0) return;

    const [y, m] = monthISO.split('-');
    const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('sv-SE', { month: 'long' });

    if (aoSheets.length === 0) {
      showToast(`Lönespec laddad${ps.employeeName ? ` för ${ps.employeeName}` : ''}. Inget AO-schema är aktivt för ${monthName} — ladda upp AO för perioden om du vill jämföra mot schema.`, 5000);
      return;
    }

    const rangeLabel = aoSheets.map((s) => periodLabel(s)).join(', ');
    showToast(`Lönespec laddad. De uppladdade AO-schemana gäller ${rangeLabel} och täcker inte ${monthName}.`, 5000);
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

          {monthHasIsVariant && (
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
          )}
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
            <span>År</span>
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
          {headerEdition && (
            <span className="ml-3 text-white/40">
              AO: {boatLabel(headerEdition.vesselName ?? headerEdition.sheetName)}
              {roleLabel(headerEdition.roles) ? ` (${roleLabel(headerEdition.roles)})` : ''}
              {headerEdition.validFrom && headerEdition.validTo
                ? ` · ${headerEdition.validFrom} – ${headerEdition.validTo}`
                : ''}
            </span>
          )}
        </p>

        {/* Ladda & importera lönespec */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const allForMonth = listPayslipsForMonth(monthISO);
              if (allForMonth.length === 0) {
                const [y, m] = monthISO.split('-');
                const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('sv-SE', { month: 'long' });
                showToast(`Ingen sparad lönespec för ${monthName} ${y}. Gå till Lönespec-sidan och tolka en PDF för denna månad.`, 4000);
                return;
              }
              if (allForMonth.length > 1) {
                setPayslipPickerList(allForMonth);
                return;
              }
              // Exakt en — ladda direkt
              const ps = allForMonth[0];
              loadAndSetPayslip(ps);
            }}
            className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
          >
            Ladda lönespec
          </button>
          {currentPayslip && (
            <>
              <button
                type="button"
                onClick={importPayslip}
                className="rounded-xl border border-green-400/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-500/20"
              >
                Importera från lönespec
              </button>
              <span className="text-xs text-[#F5F7FF]/40">
                {currentPayslip.fileName}
              </span>
            </>
          )}
          {traktamenteYearCount > 0 && (
            <button
              type="button"
              onClick={downloadTraktamente}
              className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
              title={`${traktamenteYearCount} dag(ar) markerade för obetalt traktamente under ${currentYear}`}
            >
              Ladda ner traktamente {currentYear} (PDF)
            </button>
          )}
        </div>

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

                        const resolved = resolveDay(dateISO);

                        const isException = resolved.flags?.includes('undantag');
                        const shiftHours = calcTidEnlPerShift(resolved);
                        const newEdition = editionStarts[dateISO];
                        const anyActive = shiftHours.some((_, i) => activeShifts.has(shiftKey(dateISO, i))) || manualActiveDates.has(dateISO);
                        const holidayInfo = getHolidayInfo(dateISO);
                        const deviation = payslipDeviations[dateISO];
                        const confirmed = payslipConfirmed[dateISO];

                        // Fler timmar på specen än i AO är inget problem (ljusgrönt),
                        // färre timmar är det som behöver kontrolleras (rött).
                        const specOverAo = deviation ? deviation.payslipH > deviation.aoH : false;
                        const dayBoatName = boatNameForDate(dateISO);
                        const boatOverridden = Boolean(boatByDate[dateISO]);

                        // Dag utan AO-pass men med timmar från lönespecen —
                        // ska gå att markera som jobbad ändå
                        const specHoursForDay =
                          (manualHoursByDate[dateISO] ?? 0) ||
                          (arbetadByDate[dateISO] ?? 0) ||
                          (deviation?.payslipH ?? 0);
                        const aoMissing =
                          shiftHours.length === 0 &&
                          !semesterByDate[dateISO] &&
                          (specHoursForDay > 0 || (overtimeByDate[dateISO] ?? 0) > 0);

                        // Bokförd tid (inskriven av kontoret) stämmer med
                        // avtalstiden → lila bock. Samma delmängdsmatchning
                        // som för lönespecen (hanterar på/avmönstring).
                        const bokfHours = manualHoursByDate[dateISO] ?? 0;
                        const bokfMatch =
                          bokfHours > 0 &&
                          shiftHours.length > 0 &&
                          findMatchingShifts(shiftHours, bokfHours) !== null;

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
                              confirmed
                                ? 'ring-2 ring-inset ring-green-400/80 bg-green-500/10'
                                : anyActive ? 'ring-1 ring-inset ring-green-400/50' : '',
                            ].join(' ')}
                            title={
                              aoMissing && deviation
                                ? `AO saknar pass denna dag. Lönespecen har ${fmtPayslipHours(deviation.payslipH)} h bokförd — en dag utan AO ska egentligen vara övertid, så timmarna räknas inte som vanlig arbetstid här.`
                                : deviation
                                ? `Lönespec: ${fmtPayslipHours(deviation.payslipH)} h${
                                    (plusByDate[dateISO] ?? 0) > 0
                                      ? ` (${fmtPayslipHours(deviation.payslipH - plusByDate[dateISO])} + ${fmtPayslipHours(plusByDate[dateISO])} plustid)`
                                      : ''
                                  }, AO: ${fmtPayslipHours(deviation.aoH)} h — ${fmtPayslipHours(Math.abs(deviation.payslipH - deviation.aoH))} h ${specOverAo ? 'mer' : 'mindre'} än AO`
                                : confirmed
                                ? 'Lönespec stämmer med AO-schemat'
                                : undefined
                            }
                          >
                            {aoMissing && (
                              <div className="absolute right-0 top-0 flex flex-col">
                                <span
                                  role="button"
                                  aria-label={manualActiveDates.has(dateISO) ? 'Avmarkera' : 'Markera som jobbad'}
                                  title={
                                    manualActiveDates.has(dateISO)
                                      ? 'Dagen räknas som jobbad — klicka för att ta bort'
                                      : 'AO saknar pass. Klicka för att räkna dagen som jobbad med lönespecens timmar.'
                                  }
                                  onClick={(e) => { e.stopPropagation(); toggleDayWithoutAo(dateISO, specHoursForDay); }}
                                  className={[
                                    'flex h-6 w-6 items-center justify-center rounded-bl-lg transition-colors',
                                    manualActiveDates.has(dateISO) ? 'bg-green-400/20' : 'bg-white/5 hover:bg-white/10',
                                  ].join(' ')}
                                >
                                  <span className={[
                                    'h-2.5 w-2.5 rounded-full transition-colors',
                                    manualActiveDates.has(dateISO) ? 'bg-green-400' : 'bg-purple-400/60',
                                  ].join(' ')} />
                                </span>
                              </div>
                            )}
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
                                        active && deviation
                                          ? specOverAo ? 'bg-emerald-300' : 'bg-red-700'
                                          : active ? 'bg-green-400' : 'bg-purple-400/60',
                                      ].join(' ')} />
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center gap-0.5 flex-wrap">
                              <span className="text-base font-medium">{format(date, 'd')}</span>
                              {isException && (
                                <span className="rounded bg-amber-200/30 px-1 text-[10px] text-amber-100" title="Avvikande schema denna dag enligt AO-schemat.">Avv</span>
                              )}
                              {aoMissing && (
                                <span
                                  className="rounded bg-red-500/25 px-1 text-[9px] leading-tight text-red-200"
                                  title="AO saknar pass för denna dag, men lönespecen har tid bokförd. En dag utan AO ska egentligen vara övertid — timmarna räknas därför inte som vanlig arbetstid här. Klicka på pricken om du ändå vill räkna dagen som jobbad."
                                >
                                  AO!
                                </span>
                              )}
                              {confirmed && (
                                <span className="rounded bg-green-500/25 px-1 text-[10px] leading-tight text-green-300" title="Lönespec stämmer med AO-schemat.">✓</span>
                              )}
                              {bokfMatch && !confirmed && (
                                <span className="rounded bg-purple-500/25 px-1 text-[10px] leading-tight text-purple-300" title="Bokförd tid stämmer med AO-schemat.">✓</span>
                              )}
                              {holidayInfo?.holidayType === 'storhelg' && (
                                <span className="rounded bg-red-500/30 px-1 text-[9px] leading-tight text-red-200" title="Storhelg — OB hela dygnet (påsk, pingst, midsommar, jul, nyår). Övertid räknas som kvalificerad (månadslön ÷ 72).">OB</span>
                              )}
                              {holidayInfo?.holidayType === 'småhelg' && (
                                <span className="rounded bg-amber-500/25 px-1 text-[9px] leading-tight text-amber-200" title="Småhelg — OB hela dygnet (trettondagen, 1 maj, Kristi himmelsfärd, 6 juni, Alla helgons dag). Övertid räknas som kvalificerad (månadslön ÷ 72).">sh</span>
                              )}
                              {holidayInfo !== null && holidayInfo.holidayType === null && (
                                <span className="rounded bg-violet-500/25 px-1 text-[9px] leading-tight text-violet-200" title="Dag före storhelg eller fredag — OB hela dygnet. Övertid räknas som vanlig (månadslön ÷ 104).">OB</span>
                              )}
                              {maskinByDate.has(dateISO) && (
                                <span className="rounded bg-cyan-500/25 px-1 text-[9px] leading-tight text-cyan-200" title="Maskinskötseltillägg utbetalt denna dag enligt lönespecen.">M</span>
                              )}
                              {(vabByDate[dateISO] ?? 0) > 0 && (
                                <span
                                  className="rounded bg-yellow-500/25 px-1 text-[9px] leading-tight text-yellow-200"
                                  title={`Vård av barn — ${fmtPayslipHours(vabByDate[dateISO])} h enligt lönespecen. Tiden räknas mot AO-schemat; löneavdraget visas i summeringen.`}
                                >
                                  VAB
                                </span>
                              )}
                              {traktamenteDates.has(dateISO) && (
                                <span
                                  className="rounded bg-blue-500/30 px-1 text-[9px] leading-tight text-blue-200"
                                  title={`Obetalt traktamente (övernattning ombord)${natthamnByDate[dateISO] ? ` — natthamn: ${natthamnByDate[dateISO]}` : ''}`}
                                >
                                  T
                                </span>
                              )}
                              {newEdition && (
                                <span
                                  className="rounded bg-indigo-500/30 px-1 text-[9px] leading-tight text-indigo-200"
                                  title={`Ny AO gäller från ${dateISO} — ${newEdition.vesselName ?? newEdition.sheetName} · ${periodLabel(newEdition)}`}
                                >
                                  Ny AO
                                </span>
                              )}
                            </div>
                            {shiftHours.length > 0 && (
                              <div className="mt-0.5 flex flex-col gap-0.5">
                                {shiftHours.map((h, i) => {
                                  const active = activeShifts.has(shiftKey(dateISO, i));
                                  return (
                                    <span
                                      key={i}
                                      className={['text-[13px] font-semibold leading-none transition-colors', active ? 'text-green-300' : 'text-sky-300/50'].join(' ')}
                                      title={
                                        dayBoatName
                                          ? `AO-tid för ${dayBoatName}${boatOverridden ? ' — vald för denna dag' : ''}`
                                          : undefined
                                      }
                                    >
                                      {fmtHours(h)} h{' '}
                                      <span className="text-[10px] font-normal opacity-70">avt.</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {deviation && !semesterByDate[dateISO] && !(vabByDate[dateISO] > 0) && (
                              <span
                                className={[
                                  'text-[11px] font-semibold leading-none',
                                  // Saknas AO är alltid ett fel att uppmärksamma,
                                  // aldrig "mer än AO" i grönt
                                  aoMissing || !specOverAo ? 'text-red-400' : 'text-emerald-300',
                                ].join(' ')}
                              >
                                {fmtPayslipHours(deviation.payslipH)} h löns.
                              </span>
                            )}
                            {/* VAB-dagar visar arbetad tid och VAB-tid var för sig, så
                                att tre tider syns på en dag man gått tidigt */}
                            {(vabByDate[dateISO] ?? 0) > 0 && (arbetadByDate[dateISO] ?? 0) > 0 && (
                              <span
                                className={[
                                  'block text-[11px] font-semibold leading-none',
                                  deviation ? (specOverAo ? 'text-emerald-300' : 'text-red-400') : 'text-sky-300/70',
                                ].join(' ')}
                              >
                                {fmtPayslipHours(arbetadByDate[dateISO])} h löns.
                              </span>
                            )}
                            {(vabByDate[dateISO] ?? 0) > 0 && (
                              <span
                                className="mt-0.5 block text-[12px] font-semibold leading-none text-yellow-300/90"
                                title="Vård av barn (art810). Tiden räknas mot AO-schemat; löneavdraget syns i summeringen."
                              >
                                {fmtPayslipHours(vabByDate[dateISO])} h{' '}
                                <span className="text-[10px] font-normal opacity-70">vab</span>
                              </span>
                            )}
                            {(plusByDate[dateISO] ?? 0) > 0 && (
                              <span
                                className="mt-0.5 block text-[11px] font-semibold leading-none text-lime-300/90"
                                title="Plustid (art483) — tid över årsarbetstidstaket. Ordinarie tid klipptes på lönespecen denna dag; jämförelsen mot AO använder ordinarie tid + plustid."
                              >
                                +{fmtPayslipHours(plusByDate[dateISO])} h{' '}
                                <span className="text-[10px] font-normal opacity-70">plustid</span>
                              </span>
                            )}
                            {semesterByDate[dateISO] && (
                              <span className="text-[11px] font-semibold text-amber-300">semester</span>
                            )}
                            {(manualHoursByDate[dateISO] ?? 0) > 0 && (
                              <span className="mt-0.5 block text-[12px] font-semibold leading-none text-green-400/80">
                                {fmtHours(manualHoursByDate[dateISO])} h{' '}
                                <span className="text-[10px] font-normal opacity-70">bokf.</span>
                              </span>
                            )}
                            {(overtimeByDate[dateISO] ?? 0) > 0 && (
                              <span className="mt-0.5 block text-[12px] font-semibold leading-none text-red-400/80">
                                {fmtHours(overtimeByDate[dateISO])} h{' '}
                                <span className="text-[10px] font-normal opacity-70">öt.</span>
                              </span>
                            )}
                            {(sjukByDate[dateISO] ?? 0) > 0 && (
                              <span className="mt-0.5 block text-[12px] font-semibold leading-none text-orange-400/80">
                                {fmtHours(sjukByDate[dateISO])} h{' '}
                                <span className="text-[10px] font-normal opacity-70">sjuk</span>
                              </span>
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

      {(activeShifts.size > 0 || savedShiftCount > 0 || manualActiveDates.size > 0 || maskinByDate.size > 0 || Object.values(manualHoursByDate).some((h) => h > 0) || Object.values(overtimeByDate).some((h) => h > 0) || Object.values(sjukByDate).some((h) => h > 0) || Object.values(vabByDate).some((h) => h > 0) || kompHoursWeekday > 0 || kompHoursWeekend > 0) && (() => {
        const totalPass = savedShiftCount + activeShifts.size;
        const totalHours = savedHours + totalActiveHours;

        const sb = salaryBreakdown;

        // Komp-övertid: värde vid kontant uttag (laborera med kompPayout)
        const monthlyRateKomp = selectedTariff.monthly[groundSalarySelection.tenure];
        const kompWdRate = monthlyRateKomp / 104;
        const kompWeRate = monthlyRateKomp / 72;
        const kompTotalKr = kompHoursWeekday * kompWdRate + kompHoursWeekend * kompWeRate;
        const kompTotalHours = kompHoursWeekday + kompHoursWeekend;

        // VAB: timmarna räknas mot AO, men frånvaron dras av på lönen.
        // Beloppet står på specen (art81001) — inget behov av egen framräkning.
        const vabHours = Object.values(vabByDate).reduce((s, h) => s + h, 0);
        const vabAvdrag = Math.abs(
          Object.values(vabSekByDate).reduce((s, v) => s + v, 0),
        );
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

            {/* Löneberäkning */}
            {sb && (
              <div className="mt-3 divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">

                {/* Grundlön */}
                <div className="flex items-center gap-4 bg-white/5 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#F5F7FF]/40">
                      Grundlön — {groundSalarySelection.employmentType === 'monthly' ? 'Månadslön' : groundSalarySelection.employmentType === 'hourlySeasonal' ? 'Timlön säsong' : 'Timlön korttid'}
                    </div>
                    <div className="mt-0.5 text-2xl font-bold text-[#F5F7FF]">
                      {sb.baseSalary.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-base font-normal text-[#F5F7FF]/60">kr</span>
                    </div>
                  </div>
                </div>

                {/* OB */}
                {sb.obPay > 0 && (
                  <div className="flex items-center gap-4 bg-violet-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-violet-300/60">OB-ersättning</div>
                      <div className="mt-0.5 text-2xl font-bold text-violet-300">
                        {sb.obPay.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                      </div>
                      <div className="text-[11px] text-violet-300/40">
                        {sb.obHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h × {(sb.baseSalary / 300).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h
                      </div>
                    </div>
                  </div>
                )}

                {/* Övertid vardag */}
                {sb.overtimeWeekday > 0 && (
                  <div className="flex items-center gap-4 bg-orange-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-orange-300/60">Övertid vardag</div>
                      <div className="mt-0.5 text-2xl font-bold text-orange-300">
                        {sb.overtimeWeekday.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                      </div>
                      <div className="text-[11px] text-orange-300/40">
                        {sb.overtimeWeekdayHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h × {(sb.baseSalary / 104).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h
                      </div>
                    </div>
                  </div>
                )}

                {/* Övertid helg */}
                {sb.overtimeWeekend > 0 && (
                  <div className="flex items-center gap-4 bg-rose-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-rose-300/60">Övertid lör/sön/helg</div>
                      <div className="mt-0.5 text-2xl font-bold text-rose-300">
                        {sb.overtimeWeekend.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                      </div>
                      <div className="text-[11px] text-rose-300/40">
                        {sb.overtimeWeekendHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h × {(sb.baseSalary / 72).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h
                      </div>
                    </div>
                  </div>
                )}

                {/* Komp-övertid — laborera: behåll som komp eller ta ut kontant */}
                <div className={`px-4 py-3 ${kompPayout ? 'bg-orange-400/8' : 'bg-teal-400/8'}`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-48">
                      <div className={`text-[11px] font-medium uppercase tracking-wide ${kompPayout ? 'text-orange-300/60' : 'text-teal-300/60'}`}>
                        Komp-övertid {kompPayout ? '— tas ut kontant (ingår i bruttolönen)' : '(sparas som komp, ej utbetald)'}
                      </div>
                      <div className={`mt-0.5 text-2xl font-bold ${kompPayout ? 'text-orange-300' : 'text-teal-300'}`}>
                        {kompTotalHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h{' '}
                        <span className={`text-base font-normal ${kompPayout ? 'text-orange-300/60' : 'text-teal-300/60'}`}>
                          {kompPayout ? '= ' : '— värt '}
                          {kompTotalKr.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                          {kompPayout ? '' : ' vid utbetalning'}
                        </span>
                      </div>
                      <div className={`text-[11px] ${kompPayout ? 'text-orange-300/40' : 'text-teal-300/40'}`}>
                        vardag × {kompWdRate.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h (÷104) · helg × {kompWeRate.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h (÷72)
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-xs text-[#F5F7FF]/70">
                        vardag
                        <input
                          type="number"
                          value={kompHoursWeekday || ''}
                          min={0}
                          step={0.25}
                          placeholder="0"
                          onChange={(e) => setKompHoursWeekday(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-16 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-sm text-[#F5F7FF] [appearance:textfield]"
                        />
                        h
                      </label>
                      <label className="flex items-center gap-1 text-xs text-[#F5F7FF]/70">
                        helg
                        <input
                          type="number"
                          value={kompHoursWeekend || ''}
                          min={0}
                          step={0.25}
                          placeholder="0"
                          onChange={(e) => setKompHoursWeekend(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-16 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-sm text-[#F5F7FF] [appearance:textfield]"
                        />
                        h
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-[#F5F7FF]/90">
                        <input
                          type="checkbox"
                          checked={kompPayout}
                          onChange={(e) => setKompPayout(e.target.checked)}
                          className="h-4 w-4 accent-white"
                        />
                        Ta ut kontant
                      </label>
                    </div>
                  </div>
                </div>

                {/* Maskinskötstillägg */}
                {sb.engineAttendant > 0 && (
                  <div className="flex items-center gap-4 bg-amber-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-amber-300/60">Maskinskötstillägg</div>
                      <div className="mt-0.5 text-2xl font-bold text-amber-300">
                        {sb.engineAttendant.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                      </div>
                      <div className="text-[11px] text-amber-300/40">{sb.engineAttendantDays} dagar × {allowanceAmounts['maskinskots']} kr/dag</div>
                    </div>
                  </div>
                )}

                {/* Rederitillägg */}
                {sb.rederiAllowance > 0 && (
                  <div className="flex items-center gap-4 bg-sky-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-sky-300/60">Rederitillägg</div>
                      <div className="mt-0.5 text-2xl font-bold text-sky-300">
                        {sb.rederiAllowance.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                      </div>
                    </div>
                  </div>
                )}

                {/* Däckmanstillägg */}
                {sb.dackmanAllowance > 0 && (
                  <div className="flex items-center gap-4 bg-violet-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-violet-300/60">Däckmanstillägg</div>
                      <div className="mt-0.5 text-2xl font-bold text-violet-300">
                        {sb.dackmanAllowance.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                      </div>
                    </div>
                  </div>
                )}

                {/* Sjukavdrag */}
                {(() => {
                  const monthlyRate = selectedTariff.monthly[groundSalarySelection.tenure];
                  const sjukPerTimme = monthlyRate / 173;
                  const sjukHours = Object.values(sjukByDate).reduce((s, h) => s + h, 0);
                  const sjukAvdrag = sjukHours * sjukPerTimme;
                  if (sjukHours <= 0) return null;
                  return (
                    <div className="flex items-center gap-4 bg-red-400/8 px-4 py-3">
                      <div className="flex-1">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-red-300/60">Sjukavdrag (karensdag)</div>
                        <div className="mt-0.5 text-2xl font-bold text-red-400">
                          &minus;{sjukAvdrag.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                        </div>
                        <div className="text-[11px] text-red-300/40">
                          {sjukHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h &times; {sjukPerTimme.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/h (månadslön &divide; 173)
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* VAB-avdrag — beloppet tas från lönespecen (art81001) */}
                {vabHours > 0 && (
                  <div className="flex items-center gap-4 bg-yellow-400/8 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-yellow-300/60">VAB-avdrag (vård av barn)</div>
                      <div className="mt-0.5 text-2xl font-bold text-yellow-300">
                        {vabAvdrag > 0
                          ? <>&minus;{vabAvdrag.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr</>
                          : <>{vabHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h</>}
                      </div>
                      <div className="text-[11px] text-yellow-300/40">
                        {vabHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h frånvaro
                        {vabAvdrag > 0 ? ' — avdrag enligt lönespecen' : ' — inget avdragsbelopp på lönespecen'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Total */}
                {(() => {
                  const monthlyRate = selectedTariff.monthly[groundSalarySelection.tenure];
                  const sjukPerTimme = monthlyRate / 173;
                  const sjukHours = Object.values(sjukByDate).reduce((s, h) => s + h, 0);
                  const sjukAvdrag = sjukHours * sjukPerTimme;
                  const adjustedTotal = sb.total - sjukAvdrag - vabAvdrag + (kompPayout ? kompTotalKr : 0);
                  return (
                    <div className="flex items-center gap-4 bg-white/10 px-4 py-4">
                      <div className="flex-1">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[#F5F7FF]/50">Estimerad bruttolön</div>
                        <div className="mt-0.5 text-3xl font-bold text-[#F5F7FF]">
                          {adjustedTotal.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-lg font-normal text-[#F5F7FF]/60">kr</span>
                        </div>
                        {kompPayout && kompTotalKr > 0 && (
                          <div className="text-[11px] text-orange-300/60">
                            varav {kompTotalKr.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr kontant uttagen komp-övertid
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </section>
        );
      })()}

      <DayModal
        isOpen={isModalOpen}
        dateISO={selectedDateISO}
        resolvedDay={selectedResolvedDay}
        tidEnlKollAvt={selectedDayTidEnl}
        traktamente={selectedDateISO ? traktamenteDates.has(selectedDateISO) : false}
        onTraktamenteChange={(on) => {
          if (!selectedDateISO) return;
          setTraktamenteDates((prev) => {
            const next = new Set(prev);
            if (on) next.add(selectedDateISO);
            else next.delete(selectedDateISO);
            return next;
          });
          if (on) {
            // Föreslå senast använda natthamn för nya dagar
            const suggestion = knownNatthamnar[0];
            if (suggestion && !natthamnByDate[selectedDateISO]) {
              setNatthamnByDate((prev) => ({ ...prev, [selectedDateISO]: suggestion }));
            }
          }
        }}
        natthamn={selectedDateISO ? (natthamnByDate[selectedDateISO] ?? '') : ''}
        onNatthamnChange={(value) => {
          if (!selectedDateISO) return;
          setNatthamnByDate((prev) => ({ ...prev, [selectedDateISO]: value }));
        }}
        knownNatthamnar={knownNatthamnar}
        boats={availableBoats}
        dayBoat={selectedDateISO ? (boatByDate[selectedDateISO] ?? '') : ''}
        monthBoatLabel={availableBoats.find((b) => b.value === selectedBoat)?.label ?? ''}
        onDayBoatChange={applyDayBoat}
        maskin={selectedDateISO ? maskinByDate.has(selectedDateISO) : false}
        onMaskinChange={(on) => {
          if (!selectedDateISO) return;
          setMaskinByDate((prev) => {
            const next = new Set(prev);
            if (on) next.add(selectedDateISO);
            else next.delete(selectedDateISO);
            return next;
          });
        }}
        onClose={() => {
          // Spara ev. inskriven natthamn som förslag till kommande dagar
          if (selectedDateISO && traktamenteDates.has(selectedDateISO)) {
            const value = natthamnByDate[selectedDateISO];
            if (value) rememberNatthamn(value);
          }
          setIsModalOpen(false);
        }}
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

      {/* Payslip picker modal (multiple payslips for same month) */}
      {payslipPickerList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/15 bg-[#0B1B3A] p-6">
            <h2 className="mb-4 text-lg font-semibold">Välj lönespec att importera</h2>
            <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
              {payslipPickerList.map((ps) => (
                <button
                  key={`${ps.monthISO}:${ps.employeeName ?? ps.fileName}`}
                  type="button"
                  onClick={() => {
                    setPayslipPickerList(null);
                    loadAndSetPayslip(ps);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{ps.employeeName ?? 'Okänd'}</div>
                    <div className="truncate text-xs text-[#F5F7FF]/50">{ps.fileName}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPayslipPickerList(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}