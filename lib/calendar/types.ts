export type OvertimeCompensationType = 'cash' | 'comp';

export type AbsenceType = '' | 'semester' | 'sjuk' | 'vab';

export type DayEntry = {
  dateISO: string;
  worked: boolean;
  workedHours: number;
  overtimeSimpleHours: number;
  overtimeQualifiedHours: number;
  overtimeCompensation: OvertimeCompensationType;
  obHours: number;
  absenceType: AbsenceType;
  absenceHours: number;
  compToCashHours: number;
  note: string;
};

export type MonthState = {
  monthISO: string;
  entries: Record<string, DayEntry>;
};

export type MonthSummaryTotals = {
  totalWorkedHours: number;
  overtimeSimpleHours: number;
  overtimeQualifiedHours: number;
  obHours: number;
  vabHours: number;
  sjukHours: number;
  semesterHours: number;
};
