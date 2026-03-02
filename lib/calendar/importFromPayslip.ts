import type { PayslipArtOverview } from '@/lib/summarizePayslipArtGroups';
import {
  applyWorkedDefaults,
  createDefaultDayEntry,
  isSameMonthISO,
  normalizeDateISO,
} from '@/lib/calendar/helpers';
import type { DayEntry } from '@/lib/calendar/types';

function upsert(
  entries: Record<string, DayEntry>,
  dateISO: string,
  mutator: (entry: DayEntry) => DayEntry,
) {
  const normalizedISO = normalizeDateISO(dateISO);
  const current =
    entries[normalizedISO] ?? createDefaultDayEntry(normalizedISO);
  entries[normalizedISO] = applyWorkedDefaults(mutator(current));
}

export function importMonthFromPayslipOverview(
  monthISO: string,
  overview: PayslipArtOverview,
  currentEntries: Record<string, DayEntry>,
): Record<string, DayEntry> {
  const next = { ...currentEntries };

  const applyHoursByDate = (
    data: Record<string, number> | undefined,
    mutator: (entry: DayEntry, hours: number) => DayEntry,
  ) => {
    if (!data) return;
    for (const [dateISO, hours] of Object.entries(data)) {
      if (!isSameMonthISO(dateISO, monthISO)) continue;
      upsert(next, dateISO, (entry) => mutator(entry, hours));
    }
  };

  applyHoursByDate(overview.art301?.hoursByDateISO, (entry, hours) => ({
    ...entry,
    worked: true,
    overtimeSimpleHours: entry.overtimeSimpleHours + Math.max(0, hours),
    overtimeCompensation: 'cash',
  }));

  applyHoursByDate(overview.art302?.hoursByDateISO, (entry, hours) => ({
    ...entry,
    worked: true,
    overtimeQualifiedHours: entry.overtimeQualifiedHours + Math.max(0, hours),
    overtimeCompensation: 'cash',
  }));

  applyHoursByDate(overview.art311?.hoursByDateISO, (entry, hours) => ({
    ...entry,
    worked: true,
    overtimeSimpleHours: entry.overtimeSimpleHours + Math.max(0, hours),
    overtimeCompensation: 'comp',
  }));

  applyHoursByDate(overview.art312?.hoursByDateISO, (entry, hours) => ({
    ...entry,
    worked: true,
    overtimeQualifiedHours: entry.overtimeQualifiedHours + Math.max(0, hours),
    overtimeCompensation: 'comp',
  }));

  for (const dateISO of overview.art810?.datesISO ?? []) {
    if (!isSameMonthISO(dateISO, monthISO)) continue;
    upsert(next, dateISO, (entry) => ({
      ...entry,
      worked: true,
    }));
  }

  applyHoursByDate(overview.art80001?.hoursByDateISO, (entry, hours) => ({
    ...entry,
    absenceType: 'vab',
    absenceHours: entry.absenceHours + Math.max(0, hours),
  }));

  for (const dateISO of overview.art700?.datesISO ?? []) {
    if (!isSameMonthISO(dateISO, monthISO)) continue;
    upsert(next, dateISO, (entry) => ({
      ...entry,
      absenceType: 'semester',
      absenceHours: entry.absenceHours > 0 ? entry.absenceHours : 10,
    }));
  }

  return next;
}
