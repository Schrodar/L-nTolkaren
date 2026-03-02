'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

type DayFutureState = {
  type?: 'semester' | 'overtid' | 'sjuk' | 'annat';
  overtimeHours?: number;
};

type CalendarModalProps = {
  isOpen: boolean;
  selectedDate: Date | null;
  initialState?: DayFutureState;
  onSave: (state: DayFutureState | null) => void;
  onClose: () => void;
};

export function CalendarModal({
  isOpen,
  selectedDate,
  initialState,
  onSave,
  onClose,
}: CalendarModalProps) {
  const [selectedType, setSelectedType] = React.useState<
    '' | 'semester' | 'overtid' | 'sjuk' | 'annat'
  >('');
  const [overtimeHours, setOvertimeHours] = React.useState('');

  React.useEffect(() => {
    if (!isOpen || !selectedDate) return;
    setSelectedType(initialState?.type ?? '');
    setOvertimeHours(
      typeof initialState?.overtimeHours === 'number'
        ? String(initialState.overtimeHours)
        : '',
    );
  }, [isOpen, selectedDate, initialState]);

  React.useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !selectedDate) return null;

  const displayDate = format(selectedDate, 'd MMMM yyyy', { locale: sv });

  function handleSave() {
    if (!selectedType) {
      onSave(null);
      return;
    }

    const parsedOvertime = Number(overtimeHours.replace(',', '.'));
    const hasOvertime =
      selectedType === 'overtid' &&
      overtimeHours.trim() !== '' &&
      Number.isFinite(parsedOvertime);

    onSave({
      type: selectedType,
      overtimeHours: hasOvertime ? parsedOvertime : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0B1B3A] p-6 text-[#F5F7FF] shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Valt datum"
      >
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          {displayDate}
        </h2>

        <div className="mt-5 space-y-3">
          <label className="block text-sm text-[#F5F7FF]/85">
            Dagtyp
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(event.target.value as typeof selectedType)
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
            >
              <option value="">Ingen</option>
              <option value="semester">Semester</option>
              <option value="overtid">Övertid</option>
              <option value="sjuk">Sjuk</option>
              <option value="annat">Annat</option>
            </select>
          </label>

          {selectedType === 'overtid' ? (
            <label className="block text-sm text-[#F5F7FF]/85">
              Övertid (timmar)
              <input
                type="text"
                inputMode="decimal"
                value={overtimeHours}
                onChange={(event) => setOvertimeHours(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF]"
                placeholder="t.ex. 2,5"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onSave(null)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
          >
            Rensa
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
