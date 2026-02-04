import * as React from 'react';

import { summarizePayslipArtGroups } from '@/lib/summarizePayslipArtGroups';

export type PayslipArtGroups = {
  fileName?: string;
  artGroups: { art: string; rows: string[] }[];
  lines?: { y: number; text: string }[];
};

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}
function weekdayMonFirst(date: Date) {
  const d = date.getDay();
  return (d + 6) % 7;
}

function MonthCalendar({
  monthISO,
  markedDaysISO,
  caption,
}: {
  monthISO: string;
  markedDaysISO: string[];
  caption?: string;
}) {
  const [y, m] = monthISO.split('-').map(Number);
  const total = daysInMonth(y, m);
  const first = new Date(y, m - 1, 1);
  const offset = weekdayMonFirst(first);

  const markSet = React.useMemo(() => new Set(markedDaysISO), [markedDaysISO]);

  const cells: Array<{ day?: number; iso?: string }> = [];
  for (let i = 0; i < offset; i++) cells.push({});
  for (let day = 1; day <= total; day++) {
    const iso = `${monthISO}-${String(day).padStart(2, '0')}`;
    cells.push({ day, iso });
  }
  while (cells.length % 7 !== 0) cells.push({});

  const monthLabel = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: 'long' }).format(
    new Date(y, m - 1, 1)
  );

  const markedCount = markedDaysISO.filter((d) => d.startsWith(monthISO)).length;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Kalender</div>
          <div className="mt-1 text-sm font-semibold text-gray-900 capitalize">{monthLabel}</div>
          {caption ? <div className="mt-1 text-[11px] text-gray-500">{caption}</div> : null}
        </div>
        <div className="text-xs text-gray-600">
          Markerade: <span className="font-semibold text-gray-900">{markedCount}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] text-gray-500">
        {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, idx) => (
          <div key={`${d}-${idx}`} className="text-center font-semibold">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          const isMarked = c.iso ? markSet.has(c.iso) : false;
          return (
            <div
              key={idx}
              className={[
                'h-9 rounded-lg border text-sm flex items-center justify-center',
                c.day ? 'border-gray-200' : 'border-transparent',
                isMarked
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold'
                  : 'bg-white text-gray-700',
              ].join(' ')}
              title={c.iso ?? ''}
            >
              {c.day ?? ''}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        Markerar alla datum där ART 315 förekommer (enligt datumintervall i raden).
      </div>
    </div>
  );
}

function countRows(groups: PayslipArtGroups['artGroups']) {
  return groups.reduce((sum, g) => sum + (g.rows?.length ?? 0), 0);
}

export function PayslipArtGroupsPanel({ fileName, artGroups, lines }: PayslipArtGroups) {
  const totalRows = React.useMemo(() => countRows(artGroups), [artGroups]);

  const overview = React.useMemo(() => summarizePayslipArtGroups(artGroups), [artGroups]);

  const sorted = React.useMemo(() => {
    return [...artGroups].sort((a, b) => (b.rows?.length ?? 0) - (a.rows?.length ?? 0));
  }, [artGroups]);

  const formatSek = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(n);
  }, []);

  const formatInt = React.useCallback((n: number) => {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n);
  }, []);

  const art315 = overview.art315;
  const art315Hours = art315 ? Math.floor(art315.totalMinutes / 60) : 0;
  const art315Minutes = art315 ? Math.abs(art315.totalMinutes % 60) : 0;

  return (
    <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900">ART-rader</h2>
        <p className="mt-1 text-sm text-gray-600">
          {fileName ? fileName : '–'}
          <span className="text-gray-400"> • </span>
          <span>
            {artGroups.length} grupper, {totalRows} rader
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
        <div>
          {art315?.monthISO ? (
            <MonthCalendar
              monthISO={art315.monthISO}
              markedDaysISO={art315.datesISO}
              caption="Markerar datum med ART 315"
            />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              Kunde inte avgöra månad för kalender (inga datum i ART 315).
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Översikt</div>

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-700">Antal ART-grupper</div>
              <div className="tabular-nums font-semibold text-gray-900">{artGroups.length}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Antal ART-rader</div>
              <div className="tabular-nums font-semibold text-gray-900">{totalRows}</div>
            </div>

            <div className="pt-3" />

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Arbetstid (315)</div>
              {art315 ? (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-600">ART 315</div>
                  <div className="tabular-nums font-semibold text-gray-900">
                    {formatInt(art315Hours)} h {formatInt(art315Minutes)} min
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 315-rader.</div>
              )}
              {art315?.datesISO.length ? (
                <div className="mt-1 text-xs text-gray-500">Datum markerade: {art315.datesISO.length}</div>
              ) : null}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">Maskinskötseltillägg (2101)</div>
              {overview.art2101 ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Antal rader</div>
                    <div className="tabular-nums font-semibold text-gray-900">{overview.art2101.rowsCount}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-gray-600">Summerat belopp</div>
                    <div className="tabular-nums font-semibold text-gray-900">{formatSek(overview.art2101.sekTotal)}</div>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-600">Hittade inga 2101-rader.</div>
              )}
            </div>

            <div className="pt-2 text-[11px] text-gray-500">
              Matchar rader som börjar med artnummer:{' '}
              <span className="font-mono">
                /^\d{'{'}2,5{'}'}\s/
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Info</div>
          <div className="mt-2 text-sm text-gray-700">
            Raderna byggs genom att pdf.js text-items grupperas på samma Y-position och sedan grupperas per artnummer.
          </div>

          {typeof lines?.length === 'number' ? (
            <div className="mt-3 text-xs text-gray-600">
              Text-rader (debug): <span className="tabular-nums font-semibold text-gray-900">{lines.length}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Grupper</h3>
          <div className="text-xs text-gray-600">
            Sorterat: <span className="font-semibold text-gray-900">flest rader först</span>
          </div>
        </div>

        {overview.byArt.length ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
              <div className="text-xs font-semibold text-gray-600">Art</div>
              <div className="text-xs font-semibold text-gray-600">Rubrik (från första raden)</div>
              <div className="text-right text-xs font-semibold text-gray-600">Rader</div>
            </div>
            <div className="max-h-[260px] overflow-auto">
              {overview.byArt.map((r) => (
                <div key={r.art} className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="font-mono text-sm text-gray-800">{r.art}</div>
                  <div className="text-sm text-gray-900">
                    <div className="font-medium">{r.description}</div>
                  </div>
                  <div className="tabular-nums text-right text-sm font-semibold text-gray-900">{r.rowsCount}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {sorted.length ? (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {sorted.map((g) => (
              <div key={g.art} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <div className="font-mono text-sm font-semibold text-gray-900">{g.art}</div>
                  <div className="text-xs text-gray-600">
                    <span className="tabular-nums font-semibold text-gray-900">{g.rows.length}</span> rader
                  </div>
                </div>

                <div className="max-h-[360px] overflow-auto px-4 py-3">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-gray-800">
                    {g.rows.join('\n')}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            Inga ART-rader hittades i PDF:en.
          </div>
        )}

        {lines?.length ? (
          <details className="mt-5 rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
              Visa text-rader (debug)
            </summary>
            <div className="border-t border-gray-100 px-4 py-3">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">
                {lines.map((l) => `${l.y.toFixed(1)}\t${l.text}`).join('\n')}
              </pre>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
