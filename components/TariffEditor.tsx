'use client';

import * as React from 'react';

import {
  useLoneberakningContext,
  ALLOWANCES,
  type EmploymentType,
} from '@/components/LoneberakningContext';
import { TENURE_KEYS, type TenureKey } from '@/lib/tariffs/types';

const TENURE_LABELS: Record<TenureKey, string> = {
  beg: 'Beg',
  y1: '1 år',
  y2: '2 år',
  y4: '4 år',
  y5: '5 år',
  y6: '6 år',
  y7: '7 år',
  y8: '8 år',
  y9: '9 år',
};

const EMPLOYMENT_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: 'monthly', label: 'Månadslön (tarifflön)' },
  { value: 'hourlySeasonal', label: 'Timlön säsong/vikarie' },
  { value: 'hourlyShortTerm', label: 'Timlön korttid' },
];

const TARIFF_TABLES: Array<{
  key: EmploymentType;
  title: string;
  unit: 'kr/mån' | 'kr/tim';
}> = [
  { key: 'monthly', title: 'Månadslön', unit: 'kr/mån' },
  { key: 'hourlySeasonal', title: 'Timlön säsong/vikarie', unit: 'kr/tim' },
  { key: 'hourlyShortTerm', title: 'Timlön korttid', unit: 'kr/tim' },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function TariffEditor() {
  const {
    selectedCalendarYear,
    groundSalarySelection,
    setGroundSalarySelection,
    selectedTariffDate,
    selectedTariff,
    activeAllowances,
    toggleAllowance,
    allowanceAmounts,
    setAllowanceAmount,
  } = useLoneberakningContext();

  const selectedValue =
    selectedTariff[groundSalarySelection.employmentType][
      groundSalarySelection.tenure
    ];
  const selectedUnit =
    groundSalarySelection.employmentType === 'monthly' ? 'kr/mån' : 'kr/tim';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[#F5F7FF] sm:p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Löneinställningar</h2>
          <p className="mt-1 text-sm text-[#F5F7FF]/70">
            Tariff väljs automatiskt utifrån kalenderår {selectedCalendarYear}:{' '}
            {selectedTariffDate}.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[#F5F7FF]/90">
            Anställningstyp
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {EMPLOYMENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name="employment-type"
                  value={option.value}
                  checked={
                    groundSalarySelection.employmentType === option.value
                  }
                  onChange={() =>
                    setGroundSalarySelection({
                      ...groundSalarySelection,
                      employmentType: option.value,
                    })
                  }
                  className="accent-white"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm text-[#F5F7FF]/90">
          Nivå
          <select
            value={groundSalarySelection.tenure}
            onChange={(event) =>
              setGroundSalarySelection({
                ...groundSalarySelection,
                tenure: event.target.value as TenureKey,
              })
            }
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF] sm:max-w-xs"
          >
            {TENURE_KEYS.map((key) => (
              <option key={key} value={key}>
                {TENURE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          Löneinställning:{' '}
          <span className="font-semibold">
            {formatMoney(selectedValue)} {selectedUnit}
          </span>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[#F5F7FF]/90">Tillägg</legend>
          <div className="space-y-2">
            {ALLOWANCES.map((allowance) => {
              const active = activeAllowances.has(allowance.key);
              return (
                <label
                  key={allowance.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAllowance(allowance.key)}
                    className="h-4 w-4 accent-white"
                  />
                  <span className="flex-1">{allowance.label}</span>
                  {allowance.editable ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        value={allowanceAmounts[allowance.key]}
                        onChange={(e) => setAllowanceAmount(allowance.key, Number(e.target.value))}
                        className="w-24 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-sm text-[#F5F7FF] [appearance:textfield]"
                        min={0}
                      />
                      <span className="text-[#F5F7FF]/50">{allowance.unit}</span>
                    </span>
                  ) : (
                    <span className="text-[#F5F7FF]/60">{formatMoney(allowance.defaultAmount)} {allowance.unit}</span>
                  )}
                </label>
              );
            })}
          </div>
          {activeAllowances.size > 0 && (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm">
              Totalt tillägg:{' '}
              <span className="font-semibold text-sky-300">
                {formatMoney(
                  Array.from(activeAllowances).reduce(
                    (sum, key) => sum + allowanceAmounts[key],
                    0,
                  ),
                )}{' '}kr/mån
              </span>
            </div>
          )}
        </fieldset>

        <details className="rounded-xl border border-white/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#F5F7FF]/95">
            Visa tariff ({selectedTariffDate})
          </summary>

          <div className="mt-3 space-y-4">
            {TARIFF_TABLES.map((table) => (
              <div key={table.key} className="space-y-2">
                <h3 className="text-sm font-semibold text-[#F5F7FF]/95">
                  {table.title} ({table.unit})
                </h3>
                <div className="overflow-x-auto">
                  <div className="min-w-180 rounded-xl border border-white/10">
                    <div className="grid grid-cols-9 border-b border-white/10 bg-white/5 text-xs font-medium text-[#F5F7FF]/75">
                      {TENURE_KEYS.map((tenureKey) => (
                        <div key={tenureKey} className="px-2 py-2 text-center">
                          {TENURE_LABELS[tenureKey]}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-9 bg-white/5 text-sm text-[#F5F7FF]">
                      {TENURE_KEYS.map((tenureKey) => (
                        <div
                          key={`${table.key}-${tenureKey}`}
                          className="px-2 py-2 text-center"
                        >
                          {formatMoney(selectedTariff[table.key][tenureKey])}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
