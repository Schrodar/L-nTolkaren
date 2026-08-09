'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

import type { BoatOption, ResolvedDaySchedule } from '@/lib/schedule/types';
import { getHolidayInfo } from '@/lib/ao/holidayRules';

type DayModalProps = {
  isOpen: boolean;
  dateISO: string | null;
  resolvedDay: ResolvedDaySchedule | null;
  tidEnlKollAvt: number | null;
  maskin: boolean;
  onMaskinChange: (on: boolean) => void;
  traktamente: boolean;
  onTraktamenteChange: (on: boolean) => void;
  natthamn: string;
  onNatthamnChange: (value: string) => void;
  knownNatthamnar: string[];
  boats: BoatOption[];
  /** Båt-slug satt för just denna dag, tom sträng = månadens båt */
  dayBoat: string;
  monthBoatLabel: string;
  onDayBoatChange: (slug: string, applyRestOfMonth: boolean) => void;
  onClose: () => void;
};

function formatHHMM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function DayModal({ isOpen, dateISO, resolvedDay, tidEnlKollAvt, maskin, onMaskinChange, traktamente, onTraktamenteChange, natthamn, onNatthamnChange, knownNatthamnar, boats, dayBoat, monthBoatLabel, onDayBoatChange, onClose }: DayModalProps) {
  const [applyRestOfMonth, setApplyRestOfMonth] = React.useState(false);

  // Nollställ "resten av månaden" när en ny dag öppnas
  React.useEffect(() => {
    if (isOpen) setApplyRestOfMonth(false);
  }, [isOpen, dateISO]);

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
  const shifts = resolvedDay?.shifts ?? [];
  const isException = resolvedDay?.flags?.includes('undantag');

  const lastDayOfMonth = new Date(
    Number(dateISO.slice(0, 4)),
    Number(dateISO.slice(5, 7)),
    0,
  ).getDate();
  const dayOfMonth = Number(dateISO.slice(8, 10));
  const monthName = format(new Date(`${dateISO}T00:00:00`), 'MMMM', { locale: sv });

  const boatRow = (
    <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5">
      <label className="block text-xs text-white/60">
        Båt för dagen
        <select
          value={dayBoat}
          onChange={(e) => onDayBoatChange(e.target.value, applyRestOfMonth)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
        >
          <option value="">Månadens båt{monthBoatLabel ? ` (${monthBoatLabel})` : ''}</option>
          {boats.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </label>
      {dayOfMonth < lastDayOfMonth && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={applyRestOfMonth}
            onChange={(e) => {
              setApplyRestOfMonth(e.target.checked);
              if (e.target.checked && dayBoat) onDayBoatChange(dayBoat, true);
            }}
            className="h-4 w-4 accent-sky-400"
          />
          Gäller resten av månaden ({dayOfMonth}–{lastDayOfMonth} {monthName})
        </label>
      )}
    </div>
  );

  const maskinRow = (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5">
      <div>
        <div className="text-sm font-semibold text-cyan-300">Maskinskötseltillägg</div>
        <div className="mt-0.5 text-xs text-white/40">
          markeras automatiskt om dagen finns på lönespecen
        </div>
      </div>
      <input
        type="checkbox"
        checked={maskin}
        onChange={(e) => onMaskinChange(e.target.checked)}
        className="h-5 w-5 accent-cyan-400"
      />
    </label>
  );

  const natthamnListId = 'natthamn-forslag';
  const traktamenteRow = (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-blue-300">Obetalt traktamente</div>
          <div className="mt-0.5 text-xs text-white/40">övernattning ombord</div>
        </div>
        <input
          type="checkbox"
          checked={traktamente}
          onChange={(e) => onTraktamenteChange(e.target.checked)}
          className="h-5 w-5 accent-blue-400"
        />
      </label>

      {traktamente && (
        <label className="mt-2 block text-xs text-white/60">
          Natthamn
          <input
            type="text"
            value={natthamn}
            list={natthamnListId}
            placeholder="t.ex. Stavsnäs"
            onChange={(e) => onNatthamnChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-blue-100"
          />
          <datalist id={natthamnListId}>
            {knownNatthamnar.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </label>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#0B1B3A] p-6 text-[#F5F7FF] shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-start justify-between">
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

        {/* Två kolumner: schemat till vänster, inmatningen till höger.
            Bara denna del scrollar om fönstret är för lågt — rubrik och
            Stäng-knapp ligger utanför och är alltid nåbara. */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Vänster: dagens schema */}
            <div className="space-y-3">
              {shifts.length === 0 ? (
                <p className="text-sm text-[#F5F7FF]/60">
                  Ingen arbetstid i schemat för denna dag.
                </p>
              ) : (
                <>
                  {shifts.map((shift, i) => {
                    const work = shift.work;
                    if (!work || !work.start || !work.end) return null;
                    const breaks = shift.breaks ?? [];
                    const [sh, sm] = work.start.split(':').map(Number);
                    const [eh, em] = work.end.split(':').map(Number);
                    let bruttoMin = (eh * 60 + em) - (sh * 60 + sm);
                    if (bruttoMin < 0) bruttoMin += 24 * 60;

                    return (
                      <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        {shifts.length > 1 && (
                          <div className="mb-2 text-xs font-semibold text-[#F5F7FF]/50">
                            Pass {i + 1}
                          </div>
                        )}
                        <div className="flex items-baseline justify-between gap-2">
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
                    <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5">
                      <span className="text-sm font-semibold text-sky-300">Tid enl. avtal</span>
                      <span className="text-xl font-bold text-sky-300">
                        {tidEnlKollAvt.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Höger: inmatning och tillägg */}
            <div className="space-y-3">
              {boatRow}
              {maskinRow}
              {traktamenteRow}
            </div>
          </div>
        </div>

        <div className="mt-4 flex shrink-0 justify-end">
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