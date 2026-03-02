export const TARIFF_DATES = ['2025-10-01', '2026-10-01'] as const;

export type TariffDate = (typeof TARIFF_DATES)[number];

export const TENURE_KEYS = [
  'beg',
  'y1',
  'y2',
  'y4',
  'y5',
  'y6',
  'y7',
  'y8',
  'y9',
] as const;

export type TenureKey = (typeof TENURE_KEYS)[number];

export type TenureRates = Record<TenureKey, number>;

export type Supplements = {
  firstDeckhandMonthly: number;
  seniorRolesMonthly: number;
  rederiMonthly: {
    y3: number;
    y6: number;
    y9: number;
  };
  engineAttendantDaily: number;
};

export type HourDivisors = {
  seasonal: number;
  shortTerm: number;
};

export type TariffTable = {
  effectiveFrom: TariffDate;
  monthly: TenureRates;
  hourlySeasonal: TenureRates;
  hourlyShortTerm: TenureRates;
  supplements: Supplements;
  hourDivisors: HourDivisors;
};

export type TariffCatalog = Record<TariffDate, TariffTable>;
