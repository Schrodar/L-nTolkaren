import type {
  BoatScheduleCompact,
  BreakSpan,
  ResolvedDaySchedule,
  Shift,
  WorkSpan,
} from '@/lib/schedule/types';

const WEEKDAY_KEY_BY_NAME: Record<
  string,
  '1' | '2' | '3' | '4' | '5' | '6' | '7'
> = {
  mon: '1',
  tue: '2',
  wed: '3',
  thu: '4',
  fri: '5',
  sat: '6',
  sun: '7',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToDuration(minutes: number): string {
  const normalized = minutes < 0 ? 0 : minutes;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function computeDuration(work?: WorkSpan): string | undefined {
  if (!work) return undefined;
  if (work.duration) return work.duration;
  if (!work.start || !work.end) return undefined;

  const start = toMinutes(work.start);
  const end = toMinutes(work.end);
  if (start === null || end === null) return undefined;

  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return minutesToDuration(diff);
}

function normalizeBreak(raw: unknown): BreakSpan {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  return {
    label: typeof src.label === 'string' ? src.label : undefined,
    start: typeof src.start === 'string' ? src.start : undefined,
    end: typeof src.end === 'string' ? src.end : undefined,
  };
}

function normalizeShift(raw: unknown): Shift {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;

  let work: WorkSpan | undefined;
  if (src.work && typeof src.work === 'object') {
    const workRaw = src.work as Record<string, unknown>;
    work = {
      start: typeof workRaw.start === 'string' ? workRaw.start : undefined,
      end: typeof workRaw.end === 'string' ? workRaw.end : undefined,
      duration:
        typeof workRaw.duration === 'string' ? workRaw.duration : undefined,
    };
  } else if (
    typeof src.start === 'string' ||
    typeof src.end === 'string' ||
    typeof src.duration === 'string'
  ) {
    work = {
      start: typeof src.start === 'string' ? src.start : undefined,
      end: typeof src.end === 'string' ? src.end : undefined,
      duration: typeof src.duration === 'string' ? src.duration : undefined,
    };
  }

  const breaks = Array.isArray(src.breaks)
    ? src.breaks.map((item) => normalizeBreak(item))
    : [];

  const flags = Array.isArray(src.flags)
    ? src.flags.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    work: work
      ? {
          ...work,
          duration: computeDuration(work) ?? work.duration,
        }
      : undefined,
    breaks,
    extra: src.extra,
    flags,
  };
}

export function getISOWeekday(dateISO: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const match = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Ogiltigt dateISO: ${dateISO}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.getUTCDay();
  return (weekday === 0 ? 7 : weekday) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function normalizeStandardShifts(
  schedule: BoatScheduleCompact,
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
): Shift[] {
  const key = String(weekday) as '1' | '2' | '3' | '4' | '5' | '6' | '7';
  const fromNumeric = schedule.standard[key];
  if (Array.isArray(fromNumeric)) {
    return fromNumeric.map((shift) => normalizeShift(shift));
  }

  const namedKey = Object.keys(schedule.standard).find(
    (rawKey) => WEEKDAY_KEY_BY_NAME[rawKey.toLowerCase()] === key,
  );
  if (!namedKey) return [];

  const namedValue = (schedule.standard as Record<string, unknown>)[namedKey];
  if (!Array.isArray(namedValue)) return [];

  return namedValue.map((shift) => normalizeShift(shift));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function flattenBreaks(shifts: Shift[]): BreakSpan[] {
  return shifts.flatMap((shift) => shift.breaks ?? []);
}

export function resolveDay(
  schedule: BoatScheduleCompact,
  dateISO: string,
): ResolvedDaySchedule {
  const override = schedule.overrides?.[dateISO];
  const isStandard = !override;

  const shifts = isStandard
    ? normalizeStandardShifts(schedule, getISOWeekday(dateISO))
    : (override.shifts ?? []).map((shift) => normalizeShift(shift));

  const notes = override?.notes ?? [];
  const shiftFlags = shifts.flatMap((shift) => shift.flags ?? []);
  const flags = unique([...shiftFlags, ...(override?.flags ?? [])]);

  return {
    dateISO,
    shifts,
    isStandard,
    notes,
    flags,
  };
}
