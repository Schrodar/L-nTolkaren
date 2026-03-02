export type WorkSpan = {
  start?: string;
  end?: string;
  duration?: string;
};

export type BreakSpan = {
  label?: string;
  start?: string;
  end?: string;
};

export type Shift = {
  work?: WorkSpan;
  breaks?: BreakSpan[];
  extra?: unknown;
  flags?: string[];
};

export type OverrideDay = {
  shifts: Shift[];
  notes?: string[];
  flags?: string[];
};

export type BoatScheduleCompact = {
  boat: string;
  season: string;
  period: { from: string; to: string };
  standard: Partial<Record<'1' | '2' | '3' | '4' | '5' | '6' | '7', Shift[]>>;
  overrides: Record<string, OverrideDay>;
  meta?: Record<string, unknown>;
};

export type ResolvedDaySchedule = {
  dateISO: string;
  shifts: Shift[];
  isStandard: boolean;
  notes: string[];
  flags: string[];
};

export type BoatOption = {
  value: string;
  label: string;
};
