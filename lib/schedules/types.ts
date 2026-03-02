export type WorkSpan = {
  start: string;
  end: string;
  duration?: string;
};

export type BreakSpan = {
  label?: string;
  start: string;
  end: string;
  duration?: string;
};

export type Shift = {
  row?: number;
  work?: WorkSpan | null;
  breaks?: BreakSpan[];
  flags?: string[];
  extra?: Record<string, unknown>;
};

export type DaySchedule = {
  shifts: Shift[];
  meta?: Record<string, unknown>;
};

export type BoatSchedule = {
  boat: string;
  season: string;
  period: {
    from: string;
    to: string;
  };
  commonWorkPattern?: WorkSpan;
  days: Record<string, DaySchedule>;
};
