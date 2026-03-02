'use client';

import type { BoatOption } from '@/lib/schedule/types';

type BoatSelectProps = {
  boats: BoatOption[];
  value: string;
  onChange: (boat: string) => void;
};

export function BoatSelect({ boats, value, onChange }: BoatSelectProps) {
  return (
    <label className="block text-sm text-[#F5F7FF]/90">
      Båt
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm text-[#F5F7FF] sm:max-w-sm"
      >
        <option value="">Välj båt</option>
        {boats.map((boat) => (
          <option key={boat.value} value={boat.value}>
            {boat.label}
          </option>
        ))}
      </select>
    </label>
  );
}
