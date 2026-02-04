'use client';

import * as React from 'react';
import { count2101 } from '@/lib/litenPars';

function formatSek(n?: number) {
  if (typeof n !== 'number') return '–';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  }).format(n);
}

// Enkel summa: leta sista beloppet på varje 2101-rad (robust mot PDF-kaos)
function sum2101(rawText: string): number {
  if (!rawText) return 0;

  const rows = rawText.match(/2101[\s\S]*?(?=2101|\n|$)/g) || [];
  let sum = 0;

  for (const r of rows) {
    const nums = r.match(/[-+]?\d[\d\s]*,\d{2}/g);
    if (nums?.length) {
      const last = nums[nums.length - 1]
        .replace(/\s/g, '')
        .replace(',', '.');
      const n = Number(last);
      if (!Number.isNaN(n)) sum += n;
    }
  }

  return sum;
}

export function LitenParserKomponent({
  rawText,
}: {
  rawText: string;
}) {
  const count = React.useMemo(() => count2101(rawText), [rawText]);
  const sumSEK = React.useMemo(() => sum2101(rawText), [rawText]);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        Maskinskötseltillägg
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-gray-700">Antal (2101)</div>
          <div className="tabular-nums font-semibold text-gray-900">
            {count}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-gray-700">Summa</div>
          <div className="tabular-nums font-semibold text-gray-900">
            {formatSek(sumSEK)}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        Räknas direkt från PDF-text. Ingen avancerad parsing.
      </div>
    </div>
  );
}
