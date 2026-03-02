'use client';

import * as React from 'react';

import { DEFAULT_TARIFFS } from '@/lib/tariffs/defaultTariffs';
import {
  TENURE_KEYS,
  type TariffDate,
  type TariffTable,
  type TenureKey,
} from '@/lib/tariffs/types';

const STORAGE_KEY = 'loneberakning-settings-v1';

export type EmploymentType = 'monthly' | 'hourlySeasonal' | 'hourlyShortTerm';

export type GroundSalarySelection = {
  employmentType: EmploymentType;
  tenure: TenureKey;
};

type LoneberakningContextValue = {
  selectedCalendarYear: number;
  setSelectedCalendarYear: (year: number) => void;
  groundSalarySelection: GroundSalarySelection;
  setGroundSalarySelection: (selection: GroundSalarySelection) => void;
  selectedTariffDate: TariffDate;
  selectedTariff: TariffTable;
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

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        selectedCalendarYear?: number;
        groundSalarySelection?: GroundSalarySelection;
      };

      if (typeof parsed.selectedCalendarYear === 'number') {
        setSelectedCalendarYear(parsed.selectedCalendarYear);
      }

      if (
        parsed.groundSalarySelection &&
        (parsed.groundSalarySelection.employmentType === 'monthly' ||
          parsed.groundSalarySelection.employmentType === 'hourlySeasonal' ||
          parsed.groundSalarySelection.employmentType === 'hourlyShortTerm') &&
        TENURE_KEYS.includes(parsed.groundSalarySelection.tenure)
      ) {
        setGroundSalarySelection(parsed.groundSalarySelection);
      }
    } catch {
      // ignore broken localStorage payload
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedCalendarYear,
        groundSalarySelection,
      }),
    );
  }, [selectedCalendarYear, groundSalarySelection]);

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
