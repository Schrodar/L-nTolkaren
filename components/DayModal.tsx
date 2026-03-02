'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

import {
  applyWorkedDefaults,
  createDefaultDayEntry,
} from '@/lib/calendar/helpers';
import type {
  AbsenceType,
  DayEntry,
  OvertimeCompensationType,
} from '@/lib/calendar/types';
import type { ResolvedDaySchedule } from '@/lib/schedule/types';

type DayModalProps = {
  isOpen: boolean;
  dateISO: string | null;
  initialEntry?: DayEntry;
  resolvedDay: ResolvedDaySchedule | null;
  defaultWorkedHoursFromSchedule: number | null;
  onSave: (entry: DayEntry) => void;
  onDelete: () => void;
  onClose: () => void;
};

function parseNumberInput(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DayModal({
  isOpen,
  dateISO,
  initialEntry,
  resolvedDay,
  defaultWorkedHoursFromSchedule,
  onSave,
  onDelete,
  onClose,
}: DayModalProps) {
  const [entry, setEntry] = React.useState<DayEntry | null>(null);

  React.useEffect(() => {
    if (!isOpen || !dateISO) return;
    setEntry(initialEntry ?? createDefaultDayEntry(dateISO));
  }, [isOpen, dateISO, initialEntry]);

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

  if (!isOpen || !dateISO || !entry) return null;

  const displayDate = format(new Date(`${dateISO}T00:00:00`), 'd MMMM yyyy', {
    locale: sv,
  });

  const dayWorkSpans =
    resolvedDay?.shifts
      .map((shift) => shift.work)
      .filter((work): work is NonNullable<typeof work> => Boolean(work)) ?? [];
  const dayBreakSpans =
    resolvedDay?.shifts.flatMap((shift) => shift.breaks ?? []) ?? [];
  const dayDeviations = resolvedDay?.flags ?? [];
  const hasSchemaForDay = dayWorkSpans.length > 0;

  function updateEntry(next: Partial<DayEntry>) {
    setEntry((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function handleWorkedChange(worked: boolean) {
    if (!entry) return;
    if (worked) {
      const fallback =
        entry.workedHours > 0
          ? entry.workedHours
          : (defaultWorkedHoursFromSchedule ?? 0);
      updateEntry({ worked: true, workedHours: fallback });
      return;
    }

    updateEntry({ worked: false, workedHours: 0 });
  }

  function handleSave() {
    if (!entry) return;
    onSave(applyWorkedDefaults(entry));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0B1B3A] p-6 text-[#F5F7FF] shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Daginmatning"
      >
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          {displayDate}
        </h2>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-[#F5F7FF]/80">
          <div className="font-semibold text-[#F5F7FF]/95">Schema (JSON)</div>
          {!hasSchemaForDay ? (
            <div className="mt-1 text-[#F5F7FF]/75">Saknas i schema</div>
          ) : null}
          <div className="mt-1">
            Arbetstid:{' '}
            {dayWorkSpans.length
              ? dayWorkSpans
                  .map(
                    (span) =>
                      `${span.start}-${span.end}${span.duration ? ` (${span.duration})` : ''}`,
                  )
                  .join(', ')
              : 'Ingen'}
          </div>
          <div className="mt-1">
            Raster:{' '}
            {dayBreakSpans.length
              ? dayBreakSpans
                  .map(
                    (span) =>
                      `${span.label ? `${span.label}: ` : ''}${span.start}-${span.end}`,
                  )
                  .join(', ')
              : 'Inga'}
          </div>
          <div className="mt-1">
            Avvikelser:{' '}
            {dayDeviations.length ? dayDeviations.join(', ') : 'Inga'}
          </div>
          {resolvedDay?.notes?.length ? (
            <div className="mt-1">
              Noteringar: {resolvedDay.notes.join(', ')}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-white/10 p-3">
            <h3 className="text-sm font-semibold text-[#F5F7FF]/95">Grund</h3>

            <label className="inline-flex items-center gap-2 text-sm text-[#F5F7FF]/90">
              <input
                type="checkbox"
                checked={entry.worked}
                onChange={(event) => handleWorkedChange(event.target.checked)}
                className="accent-white"
              />
              Jobbat?
            </label>

            <label className="block text-sm text-[#F5F7FF]/90">
              Arbetade timmar
              <input
                type="text"
                inputMode="decimal"
                value={entry.workedHours || ''}
                onChange={(event) =>
                  updateEntry({
                    workedHours: parseNumberInput(event.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
                placeholder={
                  defaultWorkedHoursFromSchedule !== null
                    ? String(defaultWorkedHoursFromSchedule)
                    : '0'
                }
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 p-3">
            <h3 className="text-sm font-semibold text-[#F5F7FF]/95">Övertid</h3>

            <label className="block text-sm text-[#F5F7FF]/90">
              Enkel (timmar)
              <input
                type="text"
                inputMode="decimal"
                value={entry.overtimeSimpleHours || ''}
                onChange={(event) =>
                  updateEntry({
                    overtimeSimpleHours: parseNumberInput(event.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
              />
            </label>

            <label className="block text-sm text-[#F5F7FF]/90">
              Kvalificerad (timmar)
              <input
                type="text"
                inputMode="decimal"
                value={entry.overtimeQualifiedHours || ''}
                onChange={(event) =>
                  updateEntry({
                    overtimeQualifiedHours: parseNumberInput(
                      event.target.value,
                    ),
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm text-[#F5F7FF]/90">
                Övertid till
              </legend>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'cash', label: 'Kontant' },
                  { value: 'comp', label: 'Komp' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="overtime-compensation"
                      checked={entry.overtimeCompensation === option.value}
                      onChange={() =>
                        updateEntry({
                          overtimeCompensation:
                            option.value as OvertimeCompensationType,
                        })
                      }
                      className="accent-white"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 p-3">
            <h3 className="text-sm font-semibold text-[#F5F7FF]/95">
              OB & Komp
            </h3>

            <label className="block text-sm text-[#F5F7FF]/90">
              OB-timmar
              <input
                type="text"
                inputMode="decimal"
                value={entry.obHours || ''}
                onChange={(event) =>
                  updateEntry({ obHours: parseNumberInput(event.target.value) })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
              />
            </label>

            <label className="block text-sm text-[#F5F7FF]/90">
              Omvandla komp till pengar (timmar)
              <input
                type="text"
                inputMode="decimal"
                value={entry.compToCashHours || ''}
                onChange={(event) =>
                  updateEntry({
                    compToCashHours: parseNumberInput(event.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 p-3">
            <h3 className="text-sm font-semibold text-[#F5F7FF]/95">
              Frånvaro
            </h3>

            <label className="block text-sm text-[#F5F7FF]/90">
              Typ
              <select
                value={entry.absenceType}
                onChange={(event) =>
                  updateEntry({
                    absenceType: event.target.value as AbsenceType,
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
              >
                <option value="">Ingen</option>
                <option value="semester">Semester</option>
                <option value="sjuk">Sjuk</option>
                <option value="vab">VAB</option>
              </select>
            </label>

            {entry.absenceType ? (
              <label className="block text-sm text-[#F5F7FF]/90">
                Frånvaro timmar
                <input
                  type="text"
                  inputMode="decimal"
                  value={entry.absenceHours || ''}
                  onChange={(event) =>
                    updateEntry({
                      absenceHours: parseNumberInput(event.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
                />
              </label>
            ) : null}
          </div>

          <label className="block text-sm text-[#F5F7FF]/90 sm:col-span-2">
            Anteckning
            <textarea
              value={entry.note}
              onChange={(event) => updateEntry({ note: event.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
              placeholder="Valfri anteckning för dagen"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
          >
            Rensa dag
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl border border-white/15 bg-white px-4 py-2 text-sm font-medium text-[#0B1B3A] hover:bg-[#F5F7FF]"
          >
            Spara
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}
