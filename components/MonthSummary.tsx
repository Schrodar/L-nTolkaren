'use client';

import * as React from 'react';

import { summarizeMonthState } from '@/lib/calendar/helpers';
import type { MonthState } from '@/lib/calendar/types';

function formatHours(value: number) {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function MonthSummary({ monthState }: { monthState: MonthState }) {
  const totals = React.useMemo(
    () => summarizeMonthState(monthState),
    [monthState],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[#F5F7FF] sm:p-6">
      <h3 className="text-lg font-semibold tracking-[-0.02em]">Summering</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">Total arbetstid</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.totalWorkedHours)} h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">Övertid enkel</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.overtimeSimpleHours)} h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">Övertid kval</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.overtimeQualifiedHours)} h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">OB</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.obHours)} h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">VAB</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.vabHours)} h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">Sjuk</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.sjukHours)} h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-[#F5F7FF]/70">Semester</div>
          <div className="mt-1 font-semibold">
            {formatHours(totals.semesterHours)} h
          </div>
        </div>
      </div>
    </section>
  );
}
