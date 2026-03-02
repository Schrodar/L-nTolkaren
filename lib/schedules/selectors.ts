import type {
  BoatSchedule,
  BreakSpan,
  DaySchedule,
  Shift,
  WorkSpan,
} from '@/lib/schedules/types';

function parseDurationToHours(duration?: string): number {
  if (!duration || typeof duration !== 'string') return 0;
  const match = duration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const h = Number(match[1] ?? '0');
  const m = Number(match[2] ?? '0');
  const s = Number(match[3] ?? '0');
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s))
    return 0;
  return h + m / 60 + s / 3600;
}

function getShifts(schedule: BoatSchedule | null, dateISO: string): Shift[] {
  const day = getDaySchedule(schedule, dateISO);
  return day?.shifts ?? [];
}

export function getDaySchedule(
  schedule: BoatSchedule | null,
  dateISO: string,
): DaySchedule | null {
  if (!schedule || !schedule.days) return null;
  return schedule.days[dateISO] ?? null;
}

export function getDayWork(
  schedule: BoatSchedule | null,
  dateISO: string,
): WorkSpan[] {
  return getShifts(schedule, dateISO)
    .map((shift) => shift.work)
    .filter((work): work is WorkSpan => Boolean(work));
}

export function getDayBreaks(
  schedule: BoatSchedule | null,
  dateISO: string,
): BreakSpan[] {
  const out: BreakSpan[] = [];
  for (const shift of getShifts(schedule, dateISO)) {
    for (const breakItem of shift.breaks ?? []) {
      out.push(breakItem);
    }
  }
  return out;
}

export function getDayDeviations(
  schedule: BoatSchedule | null,
  dateISO: string,
): string[] {
  const out = new Set<string>();
  const day = getDaySchedule(schedule, dateISO);

  for (const shift of day?.shifts ?? []) {
    for (const flag of shift.flags ?? []) {
      if (flag.trim()) out.add(flag.trim());
    }
  }

  const metaDeviations = day?.meta?.deviations;
  if (Array.isArray(metaDeviations)) {
    for (const value of metaDeviations) {
      if (typeof value === 'string' && value.trim()) {
        out.add(value.trim());
      }
    }
  }

  return Array.from(out);
}

export function getDayPlannedHours(
  schedule: BoatSchedule | null,
  dateISO: string,
): number | null {
  const dayWork = getDayWork(schedule, dateISO);
  if (!dayWork.length) return null;

  const sum = dayWork.reduce((total, span) => {
    return total + parseDurationToHours(span.duration);
  }, 0);

  if (sum > 0) return sum;

  const common = schedule?.commonWorkPattern?.duration;
  const commonHours = parseDurationToHours(common);
  return commonHours > 0 ? commonHours : null;
}
