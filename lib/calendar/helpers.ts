import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import type {
  DayEntry,
  MonthState,
  MonthSummaryTotals,
} from '@/lib/calendar/types';

export function normalizeDateISO(value: Date | string): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Ogiltigt dateISO: ${value}`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function getMonthISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDaysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function isSameMonth(date: Date, monthISO: string): boolean {
  return getMonthISO(date) === monthISO;
}

export function isSameMonthISO(dateISO: string, monthISO: string): boolean {
  return normalizeDateISO(dateISO).startsWith(`${monthISO}-`);
}

export function getMonthGridDates(currentMonth: Date): Date[] {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const out: Date[] = [];
  let cursor = calendarStart;
  while (cursor <= calendarEnd) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function createDefaultDayEntry(dateISO: string): DayEntry {
  const normalized = normalizeDateISO(dateISO);
  return {
    dateISO: normalized,
    worked: false,
    workedHours: 0,
    overtimeSimpleHours: 0,
    overtimeQualifiedHours: 0,
    overtimeCompensation: 'cash',
    obHours: 0,
    absenceType: '',
    absenceHours: 0,
    compToCashHours: 0,
    note: '',
  };
}

export function applyWorkedDefaults(entry: DayEntry): DayEntry {
  return entry;
}

export function isDayEntryEmpty(entry: DayEntry): boolean {
  const normalized = applyWorkedDefaults(entry);
  return (
    !normalized.worked &&
    normalized.workedHours <= 0 &&
    normalized.overtimeSimpleHours <= 0 &&
    normalized.overtimeQualifiedHours <= 0 &&
    normalized.obHours <= 0 &&
    normalized.absenceType === '' &&
    normalized.absenceHours <= 0 &&
    normalized.compToCashHours <= 0 &&
    normalized.note.trim().length === 0
  );
}

export function buildMonthState(
  monthISO: string,
  allEntries: Record<string, DayEntry>,
): MonthState {
  const entries: Record<string, DayEntry> = {};
  for (const [dateISO, entry] of Object.entries(allEntries)) {
    if (isSameMonthISO(dateISO, monthISO)) {
      entries[dateISO] = entry;
    }
  }
  return { monthISO, entries };
}

export function summarizeMonthState(
  monthState: MonthState,
): MonthSummaryTotals {
  const totals: MonthSummaryTotals = {
    totalWorkedHours: 0,
    overtimeSimpleHours: 0,
    overtimeQualifiedHours: 0,
    obHours: 0,
    vabHours: 0,
    sjukHours: 0,
    semesterHours: 0,
  };

  for (const entry of Object.values(monthState.entries)) {
    const normalized = applyWorkedDefaults(entry);

    totals.totalWorkedHours += normalized.workedHours;
    totals.overtimeSimpleHours += normalized.overtimeSimpleHours;
    totals.overtimeQualifiedHours += normalized.overtimeQualifiedHours;
    totals.obHours += normalized.obHours;

    if (normalized.absenceType === 'vab') {
      totals.vabHours += normalized.absenceHours;
    } else if (normalized.absenceType === 'sjuk') {
      totals.sjukHours += normalized.absenceHours;
    } else if (normalized.absenceType === 'semester') {
      totals.semesterHours += normalized.absenceHours;
    }
  }

  return totals;
}
