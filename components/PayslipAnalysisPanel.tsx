import * as React from 'react';
import type { PayslipAnalysis, PayslipLine } from '@/lib/parseBlidosundsPayslip';

function formatSek(n?: number) {
  if (typeof n !== 'number') return '–';
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(n);
}

function formatHours(n?: number) {
  if (typeof n !== 'number') return '–';
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n);
}

function formatNumber(n?: number) {
  if (typeof n !== 'number') return '–';
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n);
}

// ---- Calendar helpers ----

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}
function weekdayMonFirst(date: Date) {
  const d = date.getDay();
  return (d + 6) % 7;
}

function prevMonthISO(ym: string): string | null {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;

  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function inferCalendarMonthISO(lines: PayslipLine[]): string | null {
  const counts = new Map<string, number>();
  for (const l of lines) {
    if (!l.dateFrom) continue;
    const ym = l.dateFrom.slice(0, 7);
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [ym, n] of counts) {
    if (n > bestN) {
      best = ym;
      bestN = n;
    }
  }
  return best;
}

function extractWorkDays(lines: PayslipLine[]): string[] {
  const daySet = new Set<string>();
  const isWorkSignal = (code: string) => code === '315' || code === '2101';

  for (const l of lines) {
    if (!isWorkSignal(l.code)) continue;
    if (l.dateFrom && l.dateTo && l.dateFrom === l.dateTo) daySet.add(l.dateFrom);
    if (l.dateFrom && !l.dateTo) daySet.add(l.dateFrom);
  }

  return Array.from(daySet).sort();
}

function WorkDaysCalendar({
  monthISO,
  workDaysISO,
  caption,
}: {
  monthISO: string;
  workDaysISO: string[];
  caption?: string;
}) {
  const [y, m] = monthISO.split('-').map(Number);
  const total = daysInMonth(y, m);
  const first = new Date(y, m - 1, 1);
  const offset = weekdayMonFirst(first);

  const workSet = React.useMemo(() => new Set(workDaysISO), [workDaysISO]);

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

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Kalender</div>
          <div className="mt-1 text-sm font-semibold text-gray-900 capitalize">{monthLabel}</div>
          {caption ? <div className="mt-1 text-[11px] text-gray-500">{caption}</div> : null}
        </div>
        <div className="text-xs text-gray-600">
          Markerade: <span className="font-semibold text-gray-900">{workDaysISO.length}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] text-gray-500">
        {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d) => (
          <div key={d} className="text-center font-semibold">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          const isWork = c.iso ? workSet.has(c.iso) : false;
          return (
            <div
              key={idx}
              className={[
                'h-9 rounded-lg border text-sm flex items-center justify-center',
                c.day ? 'border-gray-200' : 'border-transparent',
                isWork
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
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
        Kalendern visar bara datum-säkra rader (t.ex. kod 315 / 2101 med datum). Datumlösa rader räknas i totaler men
        visas inte i kalendern.
      </div>
    </div>
  );
}

// ✅ Art-tabell: art + beskrivning + antal
function ArtCountsTable({
  rows,
}: {
  rows: Array<{ art: string; description: string; count: number }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="text-xs font-semibold text-gray-600">Art</div>
        <div className="text-xs font-semibold text-gray-600">Beskrivning</div>
        <div className="text-right text-xs font-semibold text-gray-600">Antal</div>
      </div>

      <div className="max-h-[520px] overflow-auto">
        {rows.length ? (
          rows.map((r) => (
            <div
              key={r.art}
              className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-gray-100 px-4 py-3"
            >
              <div className="font-mono text-sm text-gray-700">{r.art}</div>
              <div className="text-sm text-gray-900">
                <div className="font-medium">{r.description}</div>
                <div className="mt-0.5 text-xs text-gray-500">{r.count} st</div>
              </div>
              <div className="tabular-nums text-right text-sm font-semibold text-gray-900">{r.count}</div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-gray-600">Inga arter att visa.</div>
        )}
      </div>
    </div>
  );
}

export function PayslipAnalysisPanel({
  analysis,
  title = 'Lönespec – sammanfattning',
}: {
  analysis: PayslipAnalysis;
  title?: string;
}) {
  let periodLabel = '–';
  if (analysis.period) periodLabel = `${analysis.period.from} → ${analysis.period.to}`;

  const workDaysAll = React.useMemo(() => extractWorkDays(analysis.lines), [analysis.lines]);

  const payMonthISO = analysis.period?.from ? analysis.period.from.slice(0, 7) : null;
  const earnedMonthISO = payMonthISO ? prevMonthISO(payMonthISO) : null;
  const monthISO = earnedMonthISO ?? inferCalendarMonthISO(analysis.lines);

  const workDays = React.useMemo(() => {
    if (!monthISO) return [];
    return workDaysAll.filter((d) => d.startsWith(monthISO));
  }, [workDaysAll, monthISO]);

  // ✅ antal maskinskötseltillägg ska komma från artCounts (pdfjs / artGroups)
  const artCounts = React.useMemo(() => analysis.artCounts ?? [], [analysis.artCounts]);
  const maskinCount = React.useMemo(() => {
    const r = artCounts.find((x) => x.art === '2101');
    return r?.count ?? 0;
  }, [artCounts]);

  const calendarCaption = React.useMemo(() => {
    if (payMonthISO && earnedMonthISO) return `Intjänad månad (lönemånad ${payMonthISO} → jobb ${earnedMonthISO})`;
    if (monthISO) return `Månad vald från tillgänglig data: ${monthISO}`;
    return undefined;
  }, [payMonthISO, earnedMonthISO, monthISO]);

  return (
    <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {analysis.employer ?? '–'}
          {analysis.employeeName ? ` • ${analysis.employeeName}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
        <div>
          {monthISO ? (
            <WorkDaysCalendar monthISO={monthISO} workDaysISO={workDays} caption={calendarCaption} />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              Kunde inte avgöra månad för kalender.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Översikt</div>

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-700">Antal dagar jobbade (i kalendern)</div>
              <div className="tabular-nums font-semibold text-gray-900">{workDays.length}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Maskinskötseltillägg (antal)</div>
              <div className="tabular-nums font-semibold text-gray-900">{formatNumber(maskinCount)}</div>
            </div>

            <div className="pt-2" />

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Lönemånad</div>
              <div className="font-medium text-gray-900">{payMonthISO ?? '–'}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Intjänad månad (kalender)</div>
              <div className="font-medium text-gray-900">{monthISO ?? '–'}</div>
            </div>

            <div className="pt-2" />

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Period</div>
              <div className="font-medium text-gray-900">{periodLabel}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Utbetalningsdag</div>
              <div className="font-medium text-gray-900">{analysis.payoutDate ?? '–'}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-700">Att utbetala</div>
              <div className="tabular-nums font-semibold text-gray-900">{formatSek(analysis.netPaySEK)}</div>
            </div>
          </div>

          {analysis.notes?.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-semibold text-amber-900">Noteringar</div>
              <ul className="mt-2 space-y-1">
                {analysis.notes.map((n, i) => (
                  <li key={i} className="text-xs text-amber-900">
                    • {n}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Tidssaldon</div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-700">Komp</div>
            <div className="tabular-nums text-sm font-medium text-gray-900">{formatHours(analysis.compHours)}</div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-gray-700">Årsarbetstid</div>
            <div className="tabular-nums text-sm font-medium text-gray-900">
              {formatHours(analysis.annualWorkTimeHours)}
            </div>
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Lön</div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-gray-700">Brutto (period)</div>
              <div className="tabular-nums text-sm font-semibold text-gray-900">{formatSek(analysis.grossPeriodSEK)}</div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-gray-700">Skatt</div>
              <div className="tabular-nums text-sm font-semibold text-gray-900">
                {formatSek(analysis.preliminaryTaxPeriodSEK)}
                {analysis.taxTable ? ` • Tabell ${analysis.taxTable}` : ''}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-gray-700">Fackavgift</div>
              <div className="tabular-nums text-sm font-semibold text-gray-900">{formatSek(analysis.unionFeeSEK)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Endast Art-tabellen (Summerade lönearter borttagen) */}
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Arter (antal)</h3>
          <div className="text-xs text-gray-500">{artCounts.length} arter</div>
        </div>

        <div className="mt-3">
          <ArtCountsTable rows={artCounts} />
        </div>
      </div>
    </section>
  );
}
