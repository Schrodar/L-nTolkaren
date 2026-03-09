'use client';

import * as React from 'react';

import { DEFAULT_TARIFFS } from '@/lib/tariffs/defaultTariffs';
import {
  TENURE_KEYS,
  type TariffDate,
  type TariffTable,
  type TenureKey,
} from '@/lib/tariffs/types';

export type EmploymentType = 'monthly' | 'hourlySeasonal' | 'hourlyShortTerm';

export type AllowanceKey = 'maskinskots' | 'rederi' | 'dackman';

export const ALLOWANCES: Array<{ key: AllowanceKey; label: string; defaultAmount: number; editable: boolean; unit: string }> = [
  { key: 'maskinskots', label: 'Maskinskötstillägg', defaultAmount: 165,  editable: true,  unit: 'kr/dag' },
  { key: 'rederi',     label: 'Rederitillägg',       defaultAmount: 655,  editable: false, unit: 'kr/mån' },
  { key: 'dackman',   label: 'Däckmanstillägg',      defaultAmount: 2721, editable: false, unit: 'kr/mån' },
];

export type GroundSalarySelection = {
  employmentType: EmploymentType;
  tenure: TenureKey;
};

export type AllowanceAmounts = Record<AllowanceKey, number>;

type LoneberakningContextValue = {
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
};

const LoneberakningContext =
  React.createContext<LoneberakningContextValue | null>(null);

function resolveTariffDate(year: number): TariffDate {
  return year <= 2025 ? '2025-10-01' : '2026-10-01';
}

export function LoneberakningProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedCalendarYear, setSelectedCalendarYear] = React.useState(() =>
    new Date().getFullYear(),
  );
  const [groundSalarySelection, setGroundSalarySelection] =
    React.useState<GroundSalarySelection>({
      employmentType: 'monthly',
      tenure: 'beg',
    });

  const [activeAllowances, setActiveAllowances] = React.useState<Set<AllowanceKey>>(new Set());
  const [allowanceAmounts, setAllowanceAmounts] = React.useState<AllowanceAmounts>(
    Object.fromEntries(ALLOWANCES.map((a) => [a.key, a.defaultAmount])) as AllowanceAmounts,
  );

  function toggleAllowance(key: AllowanceKey) {
    setActiveAllowances((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function setAllowanceAmount(key: AllowanceKey, amount: number) {
    setAllowanceAmounts((prev) => ({ ...prev, [key]: amount }));
  }

  const selectedTariffDate = resolveTariffDate(selectedCalendarYear);
  const selectedTariff = DEFAULT_TARIFFS[selectedTariffDate];

  return (
    <LoneberakningContext.Provider
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
      }}
    >
      {children}
    </LoneberakningContext.Provider>
  );
}

export function useLoneberakningContext() {
  const context = React.useContext(LoneberakningContext);
  if (!context) {
    throw new Error(
      'useLoneberakningContext måste användas inom LoneberakningProvider',
    );
  }
  return context;
}
