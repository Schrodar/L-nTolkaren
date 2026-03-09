'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

import type { ResolvedDaySchedule } from '@/lib/schedule/types';
import { getHolidayInfo, getEffectiveAoDayType } from '@/lib/ao/holidayRules';

type DayModalProps = {
  isOpen: boolean;
  dateISO: string | null;
  resolvedDay: ResolvedDaySchedule | null;
  tidEnlKollAvt: number | null;
  overtime: number;
  onOvertimeChange: (hours: number) => void;
  onClose: () => void;
};

function formatHHMM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function DayModal({ isOpen, dateISO, resolvedDay, tidEnlKollAvt, overtime, onOvertimeChange, onClose }: DayModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !dateISO) return null;

  const displayDate = format(new Date(`${dateISO}T00:00:00`), 'd MMMM yyyy', { locale: sv });
  const holidayInfo = getHolidayInfo(dateISO);
  const eff = getEffectiveAoDayType(dateISO);
  let otLabel: string;
  let otColor: string;
  let otBorder: string;
  let otInputColor: string;
  if (eff === 'söndag' || eff === 'lördag') {
    otLabel = 'Kvalificerad övertid';
    otColor = 'text-rose-300';
    otBorder = 'border-rose-500/30 bg-rose-500/10';
    otInputColor = 'text-rose-200';
  } else if (eff === 'fredag') {
    otLabel = 'Fredag-OB';
    otColor = 'text-violet-300';
    otBorder = 'border-violet-500/30 bg-violet-500/10';
    otInputColor = 'text-violet-200';
  } else {
    otLabel = 'Vanlig övertid';
    otColor = 'text-orange-300';
    otBorder = 'border-orange-500/30 bg-orange-500/10';
    otInputColor = 'text-orange-200';
  }
  const shifts = resolvedDay?.shifts ?? [];
  const isException = resolvedDay?.flags?.includes('undantag');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0B1B3A] p-6 text-[#F5F7FF] shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">{displayDate}</h2>
          <div className="flex flex-wrap gap-1 justify-end">
            {isException && (
              <span className="rounded bg-amber-200/30 px-2 py-1 text-xs text-amber-100">Undantag</span>
            )}
            {holidayInfo?.holidayType === 'storhelg' && (
              <span className="rounded bg-red-500/25 px-2 py-1 text-xs text-red-200">{holidayInfo.label}</span>
            )}
            {holidayInfo?.holidayType === 'småhelg' && (
              <span className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-100">{holidayInfo.label}</span>
            )}
            {holidayInfo !== null && holidayInfo.holidayType === null && (
              <span className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-200">{holidayInfo.label}</span>
            )}
          </div>
        </div>

        {shifts.length === 0 ? (
          <p className="mt-4 text-sm text-[#F5F7FF]/60">
            Ingen arbetstid i schemat för denna dag.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {shifts.map((shift, i) => {
              const work = shift.work;
              if (!work || !work.start || !work.end) return null;
              const breaks = shift.breaks ?? [];
              const [sh, sm] = work.start.split(':').map(Number);
              const [eh, em] = work.end.split(':').map(Number);
              let bruttoMin = (eh * 60 + em) - (sh * 60 + sm);
              if (bruttoMin < 0) bruttoMin += 24 * 60;

              return (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  {shifts.length > 1 && (
                    <div className="mb-2 text-xs font-semibold text-[#F5F7FF]/50">
                      Pass {i + 1}
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-semibold">
                      {work.start} – {work.end}
                    </span>
                    <span className="text-sm text-green-400">
                      Brutto {formatHHMM(bruttoMin / 60)}
                    </span>
                  </div>
                  {breaks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {breaks.map((br, j) => (
                        <div key={j} className="text-xs text-[#F5F7FF]/60">
                          {br.label ?? 'Rast'}: {br.start} – {br.end}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {tidEnlKollAvt !== null && (
              <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                <span className="text-sm font-semibold text-sky-300">Tid enl. avtal</span>
                <span className="text-xl font-bold text-sky-300">
                  {formatHHMM(tidEnlKollAvt)}
                </span>
              </div>
            )}

            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${otBorder}`}>
              <div>
                <div className={`text-sm font-semibold ${otColor}`}>{otLabel}</div>
                <div className="mt-0.5 text-xs text-white/40">timmar idag</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={overtime || ''}
                  min={0}
                  step={0.5}
                  placeholder="0"
                  onChange={(e) => onOvertimeChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  className={`w-20 rounded-lg border border-white/15 bg-[#0B1B3A] px-2 py-1 text-right text-lg font-bold [appearance:textfield] ${otInputColor}`}
                />
                <span className={`text-sm ${otColor}`}>h</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 px-5 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}