'use client';

/**
 * AppContext — global state med localStorage-persistens.
 *
 * Hanterar:
 *   1. Löneinställningar (anställningstyp, anciennitet, tillägg) — sparas i localStorage
 *   2. Kalenderdata per månad (pass, manuell tid, övertid) — sparas i localStorage
 *   3. Parsad lönespec-data — sparas i localStorage, redo att importeras i lönemallen
 */

import * as React from 'react';

import { DEFAULT_TARIFFS } from '@/lib/tariffs/defaultTariffs';
import {
  TENURE_KEYS,
  type TariffDate,
  type TariffTable,
  type TenureKey,
} from '@/lib/tariffs/types';
import type { AoMode } from '@/lib/ao/types';
import type { PayslipArtOverview } from '@/lib/summarizePayslipArtGroups';

// ── Typer ────────────────────────────────────────────────────────────────────

export type EmploymentType = 'monthly' | 'hourlySeasonal' | 'hourlyShortTerm';
export type AllowanceKey = 'maskinskots' | 'rederi' | 'dackman';

export const ALLOWANCES: Array<{
  key: AllowanceKey;
  label: string;
  defaultAmount: number;
  editable: boolean;
  unit: string;
}> = [
  { key: 'maskinskots', label: 'Maskinskötstillägg', defaultAmount: 165,  editable: true,  unit: 'kr/dag' },
  { key: 'rederi',      label: 'Rederitillägg',      defaultAmount: 655,  editable: false, unit: 'kr/mån' },
  { key: 'dackman',    label: 'Däckmanstillägg',     defaultAmount: 2721, editable: false, unit: 'kr/mån' },
];

export type GroundSalarySelection = {
  employmentType: EmploymentType;
  tenure: TenureKey;
};

export type AllowanceAmounts = Record<AllowanceKey, number>;

/**
 * Sparad månadsdata — allt som behövs för att återskapa löneberäkningen.
 */
export type SavedMonth = {
  monthISO: string;                              // "2026-04"
  boatSlug: string;                              // "soderarm-reg-bet-sbfw-fartygsnr"
  mode: AoMode;                                  // "is" | "isfri"
  activeShifts: string[];                        // ["2026-04-13::0", ...]
  manualHoursByDate: Record<string, number>;     // manuellt inmatad ordinarie tid
  overtimeByDate: Record<string, number>;        // övertidstimmar per datum
  kompHoursWeekday: number;                      // komp-övertid vardag (art311)
  kompHoursWeekend: number;                      // komp-övertid helg (art312)
  sjukByDate: Record<string, number>;            // datum → sjuktimmar (art80001)
  semesterByDate: Record<string, boolean>;       // datum → semesterdag (art700)
  manualActiveDates?: string[];                   // aktiva dagar utan AO-pass
  savedAt: string;                               // ISO-timestamp
};

/**
 * Sparad lönespec-data från PDF-parsern.
 * Lagras tills användaren importerar den till lönemallen eller rensar den.
 */
export type SavedPayslip = {
  fileName: string;
  monthISO: string | null;    // "2026-01" om parsern kunde avgöra månaden
  employeeName: string | null;
  overview: PayslipArtOverview;
  savedAt: string;
};

// ── localStorage-nycklar ──────────────────────────────────────────────────────

const LS_SETTINGS = 'loneberakning:settings';
const LS_MONTH_PREFIX = 'loneberakning:month:';
const LS_PAYSLIP_PREFIX = 'loneberakning:payslip:';

// ── Hjälpfunktioner ──────────────────────────────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full eller blockerat — ignorera tyst
  }
}

function deleteLS(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorera
  }
}

// ── Inställningar-typ (sparas i localStorage) ────────────────────────────────

type PersistedSettings = {
  selectedCalendarYear: number;
  groundSalarySelection: GroundSalarySelection;
  activeAllowances: AllowanceKey[];
  allowanceAmounts: AllowanceAmounts;
};

// ── Context-värde ─────────────────────────────────────────────────────────────

type AppContextValue = {
  // Löneinställningar
  selectedCalendarYear: number;
  setSelectedCalendarYear: (year: number) => void;
  groundSalarySelection: GroundSalarySelection;
  setGroundSalarySelection: (selection: GroundSalarySelection) => void;
  selectedTariffDate: TariffDate;
  selectedTariff: TariffTable;
  activeAllowances: Set<AllowanceKey>;
  toggleAllowance: (key: AllowanceKey) => void;
  allowanceAmounts: AllowanceAmounts;
  setAllowanceAmount: (key: AllowanceKey, amount: number) => void;

  // Månadsdata
  saveMonth: (month: SavedMonth) => void;
  loadMonth: (monthISO: string) => SavedMonth | null;
  deleteMonth: (monthISO: string) => void;
  listSavedMonths: () => SavedMonth[];

  // Lönespec-data
  savePayslip: (payslip: SavedPayslip) => void;
  loadPayslip: (monthISO: string) => SavedPayslip | null;
  listPayslips: () => SavedPayslip[];
  listPayslipsForMonth: (monthISO: string) => SavedPayslip[];
  deletePayslip: (monthISO: string, employeeName?: string | null) => void;
};

const AppContext = React.createContext<AppContextValue | null>(null);

function resolveTariffDate(year: number): TariffDate {
  return year <= 2025 ? '2025-10-01' : '2026-10-01';
}

// ── Provider ──────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWANCE_AMOUNTS = Object.fromEntries(
  ALLOWANCES.map((a) => [a.key, a.defaultAmount])
) as AllowanceAmounts;

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Initiera med rena defaults — ingen localStorage här (SSR-säkert)
  const [selectedCalendarYear, setSelectedCalendarYearState] = React.useState(
    () => new Date().getFullYear()
  );

  const [groundSalarySelection, setGroundSalarySelectionState] =
    React.useState<GroundSalarySelection>({ employmentType: 'monthly', tenure: 'beg' });

  const [activeAllowances, setActiveAllowances] = React.useState<Set<AllowanceKey>>(
    () => new Set()
  );

  const [allowanceAmounts, setAllowanceAmounts] = React.useState<AllowanceAmounts>(
    () => DEFAULT_ALLOWANCE_AMOUNTS
  );

  // Hydration-flagga: förhindrar att spara-effekten skriver defaults till localStorage
  const [hydrated, setHydrated] = React.useState(false);

  // Läs sparade inställningar från localStorage efter mount
  React.useEffect(() => {
    const s = readLS<PersistedSettings | null>(LS_SETTINGS, null);
    if (s) {
      if (s.selectedCalendarYear != null) setSelectedCalendarYearState(s.selectedCalendarYear);
      if (s.groundSalarySelection) setGroundSalarySelectionState(s.groundSalarySelection);
      if (s.activeAllowances) setActiveAllowances(new Set(s.activeAllowances));
      if (s.allowanceAmounts) setAllowanceAmounts(s.allowanceAmounts);
    }
    setHydrated(true);
  }, []);

  // Spara inställningar till localStorage när de ändras (efter hydration)
  React.useEffect(() => {
    if (!hydrated) return;
    const settings: PersistedSettings = {
      selectedCalendarYear,
      groundSalarySelection,
      activeAllowances: Array.from(activeAllowances),
      allowanceAmounts,
    };
    writeLS(LS_SETTINGS, settings);
  }, [hydrated, selectedCalendarYear, groundSalarySelection, activeAllowances, allowanceAmounts]);

  // ── Inställnings-setters ────────────────────────────────────────────────────

  function setSelectedCalendarYear(year: number) {
    setSelectedCalendarYearState(year);
  }

  function setGroundSalarySelection(selection: GroundSalarySelection) {
    setGroundSalarySelectionState(selection);
  }

  function toggleAllowance(key: AllowanceKey) {
    setActiveAllowances((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setAllowanceAmount(key: AllowanceKey, amount: number) {
    setAllowanceAmounts((prev) => ({ ...prev, [key]: amount }));
  }

  // ── Månadsdata ──────────────────────────────────────────────────────────────

  function saveMonth(month: SavedMonth) {
    writeLS(`${LS_MONTH_PREFIX}${month.monthISO}`, month);
  }

  function loadMonth(monthISO: string): SavedMonth | null {
    return readLS<SavedMonth | null>(`${LS_MONTH_PREFIX}${monthISO}`, null);
  }

  function deleteMonth(monthISO: string) {
    deleteLS(`${LS_MONTH_PREFIX}${monthISO}`);
  }

  function listSavedMonths(): SavedMonth[] {
    const months: SavedMonth[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(LS_MONTH_PREFIX)) continue;
        const month = readLS<SavedMonth | null>(key, null);
        if (month) months.push(month);
      }
    } catch {
      // ignorera
    }
    return months.sort((a, b) => a.monthISO.localeCompare(b.monthISO));
  }

  // ── Lönespec (per månad + person) ────────────────────────────────────────────

  function payslipKey(monthISO: string, employeeName?: string | null): string {
    return employeeName
      ? `${LS_PAYSLIP_PREFIX}${monthISO}:${employeeName}`
      : `${LS_PAYSLIP_PREFIX}${monthISO}`;
  }

  function savePayslip(payslip: SavedPayslip) {
    if (!payslip.monthISO) return;
    writeLS(payslipKey(payslip.monthISO, payslip.employeeName), payslip);
  }

  function loadPayslip(monthISO: string): SavedPayslip | null {
    const all = listPayslipsForMonth(monthISO);
    return all[0] ?? null;
  }

  function listPayslipsForMonth(monthISO: string): SavedPayslip[] {
    const out: SavedPayslip[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(LS_PAYSLIP_PREFIX)) continue;
        const rest = key.slice(LS_PAYSLIP_PREFIX.length);
        const keyMonth = rest.slice(0, 7);
        if (keyMonth !== monthISO) continue;
        const p = readLS<SavedPayslip | null>(key, null);
        if (p) out.push(p);
      }
    } catch {
      // ignorera
    }
    return out;
  }

  function listPayslips(): SavedPayslip[] {
    const out: SavedPayslip[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(LS_PAYSLIP_PREFIX)) continue;
        const p = readLS<SavedPayslip | null>(key, null);
        if (p) out.push(p);
      }
    } catch {
      // ignorera
    }
    return out.sort((a, b) => (a.monthISO ?? '').localeCompare(b.monthISO ?? ''));
  }

  function deletePayslip(monthISO: string, employeeName?: string | null) {
    deleteLS(payslipKey(monthISO, employeeName));
  }

  const selectedTariffDate = resolveTariffDate(selectedCalendarYear);
  const selectedTariff = DEFAULT_TARIFFS[selectedTariffDate];

  return (
    <AppContext.Provider
      value={{
        selectedCalendarYear,
        setSelectedCalendarYear,
        groundSalarySelection,
        setGroundSalarySelection,
        selectedTariffDate,
        selectedTariff,
        activeAllowances,
        toggleAllowance,
        allowanceAmounts,
        setAllowanceAmount,
        saveMonth,
        loadMonth,
        deleteMonth,
        listSavedMonths,
        savePayslip,
        loadPayslip,
        listPayslips,
        listPayslipsForMonth,
        deletePayslip,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppContext() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext måste användas inom AppProvider');
  }
  return context;
}

/**
 * Bakåtkompatibelt alias — befintlig kod som importerar useLoneberakningContext
 * kan byta till useAppContext gradvis.
 */
export const useLoneberakningContext = useAppContext;
export const LoneberakningProvider = AppProvider;