'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAppContext, type SavedPayslip } from '@/components/AppContext';
import { SiteNav } from '@/components/SiteNav';
import {
  ARSARBETSTID_DAGAR,
  ARSARBETSTID_TIMMAR,
  buildPeriodSummaries,
  type PeriodSummering,
} from '@/lib/summering/buildPeriodSummary';

const fmtHours = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const fmtMonth = new Intl.DateTimeFormat('sv-SE', {
  month: 'long',
  year: 'numeric',
});

function monthLabel(monthISO: string): string {
  return fmtMonth.format(new Date(`${monthISO}-01T12:00:00`));
}

/**
 * Lönespecen för månad X avser arbetet i månad X−1. Augustis timmar ligger
 * alltså i septemberspecen — den spec man ska leta efter när en månad saknas.
 */
function specManadLabel(monthISO: string): string {
  const ar = Number(monthISO.slice(0, 4));
  const manad = Number(monthISO.slice(5, 7));
  if (!Number.isFinite(ar) || !Number.isFinite(manad)) return '';
  const nasta = manad === 12 ? `${ar + 1}-01` : `${ar}-${String(manad + 1).padStart(2, '0')}`;
  return monthLabel(nasta);
}

export default function SummeringPage() {
  const { listPayslips } = useAppContext();

  // localStorage får inte läsas under SSR — vänta till efter montering.
  const [payslips, setPayslips] = React.useState<SavedPayslip[] | null>(null);
  React.useEffect(() => {
    setPayslips(listPayslips());
  }, [listPayslips]);

  const perioder = React.useMemo(
    () => (payslips ? buildPeriodSummaries(payslips) : []),
    [payslips],
  );

  const [valdPeriod, setValdPeriod] = React.useState<number | null>(null);
  const period: PeriodSummering | null =
    perioder.find((p) => p.startYear === valdPeriod) ?? perioder[0] ?? null;

  return (
    <div className="min-h-dvh bg-[#0B1B3A] px-4 py-10 text-[#F5F7FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Summering
          </h1>
          <SiteNav />
        </header>

        <p className="mb-6 max-w-3xl text-sm text-[#F5F7FF]/70">
          Alla sparade lönespecar lagda på hög, räknat per begränsningsperiod
          (1 april – 31 mars). Arbetad tid är nominell tid (315) plus plustid
          (483) plus långdagstillägget (K315) — 0,4 h för varje timme över
          10,5 h per dygn. Varje semesterdag (700) noteras som 5 h och en dag
          enligt §5.2. Ett datum räknas alltid som{' '}
          <span className="font-semibold text-[#F5F7FF]">en</span> dag — aldrig
          två, oavsett hur många arter det står på.
        </p>

        {payslips === null ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[#F5F7FF]/70">
            Läser sparade lönespecar…
          </div>
        ) : !period ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">Inga sparade lönespecar</div>
            <p className="mt-2 max-w-2xl text-sm text-[#F5F7FF]/70">
              Tolka en lönespec på{' '}
              <Link href="/" className="underline hover:text-white">
                Lönespec-sidan
              </Link>{' '}
              och spara den, så dyker den upp här. Allt sparas lokalt i din
              webbläsare.
            </p>
          </div>
        ) : (
          <>
            {perioder.length > 1 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-[#F5F7FF]/50">
                  Period
                </span>
                {perioder.map((p) => {
                  const aktiv = p.startYear === period.startYear;
                  return (
                    <button
                      key={p.startYear}
                      type="button"
                      onClick={() => setValdPeriod(p.startYear)}
                      className={[
                        'rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors',
                        aktiv
                          ? 'border-white/25 bg-white/15 text-[#F5F7FF]'
                          : 'border-white/15 bg-white/5 text-[#F5F7FF]/80 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            <PeriodOversikt period={period} />

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold">Per månad</h2>
              <p className="mb-4 text-xs text-[#F5F7FF]/60">
                Månaden är arbetsmånaden, inte specmånaden. Lönespecen för en
                månad avser arbetet i månaden före — augustis tid syns alltså i
                septemberspecen, och julis i augustispecen. Månader märkta{' '}
                <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                  ingen spec
                </span>{' '}
                saknar importerad lönespec och räknas inte in i summan — raden
                visar vilken spec som fyller den.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[#F5F7FF]/50">
                      <th className="py-2 pr-3 font-medium">Månad</th>
                      <th className="py-2 pr-3 text-right font-medium">Dagar</th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Nominell (315)
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Plustid (483)
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Långdag (K315)
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Semester (700)
                      </th>
                      <th className="py-2 text-right font-medium">Totalt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.manader.map((m) => (
                      <tr
                        key={m.monthISO}
                        className={`border-b border-white/5 last:border-0 ${
                          m.saknasImport ? 'text-amber-200/70' : ''
                        }`}
                      >
                        <td
                          className="py-2 pr-3 capitalize"
                          title={
                            m.saknasImport
                              ? `Ingen lönespec importerad. Tiden för ${monthLabel(m.monthISO)} finns i lönespecen för ${specManadLabel(m.monthISO)}.`
                              : m.kallor.join(', ')
                          }
                        >
                          {monthLabel(m.monthISO)}
                          {m.saknasImport ? (
                            <>
                              <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-200">
                                ingen spec
                              </span>
                              <span className="mt-0.5 block text-[11px] font-normal normal-case text-amber-200/60">
                                Finns i lönespecen för{' '}
                                {specManadLabel(m.monthISO)}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td
                          className="py-2 pr-3 text-right tabular-nums"
                          title={`${m.arbetsDagar} arbetsdagar, ${m.semesterDagar} semesterdagar`}
                        >
                          {m.saknasImport ? '–' : fmtInt.format(m.dagar)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[#F5F7FF]/75">
                          {m.saknasImport ? '–' : `${fmtHours.format(m.nominell)} h`}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[#F5F7FF]/75">
                          {m.plus > 0 ? `${fmtHours.format(m.plus)} h` : '–'}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[#F5F7FF]/75">
                          {m.langdagTimmar > 0
                            ? `${fmtHours.format(m.langdagTimmar)} h`
                            : '–'}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[#F5F7FF]/75">
                          {m.semesterTimmar > 0
                            ? `${fmtHours.format(m.semesterTimmar)} h`
                            : '–'}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {m.saknasImport ? '–' : `${fmtHours.format(m.total)} h`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/15 font-semibold">
                      <td className="py-2 pr-3">Summa</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtInt.format(period.dagar)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtHours.format(period.nominell)} h
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtHours.format(period.plus)} h
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtHours.format(period.langdagTimmar)} h
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtHours.format(period.semesterTimmar)} h
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtHours.format(period.timmar)} h
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function PeriodOversikt({ period }: { period: PeriodSummering }) {
  const kvarTimmar = ARSARBETSTID_TIMMAR - period.timmar;
  const kvarDagar = ARSARBETSTID_DAGAR - period.dagar;
  const andel = Math.min(1, period.timmar / ARSARBETSTID_TIMMAR);
  const over = kvarTimmar < 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Arbetade dagar"
          value={fmtInt.format(period.dagar)}
          unit="dagar"
          note={
            <>
              <div>
                {kvarDagar >= 0
                  ? `${fmtInt.format(kvarDagar)} kvar till ${ARSARBETSTID_DAGAR}`
                  : `${fmtInt.format(-kvarDagar)} över ${ARSARBETSTID_DAGAR}`}
              </div>
              <div>
                Arbete: {fmtInt.format(period.arbetsDagar)} · Semester:{' '}
                {fmtInt.format(period.semesterDagar)}
              </div>
            </>
          }
          alert={kvarDagar < 0}
        />
        <StatCard
          label="Arbetade timmar"
          value={fmtHours.format(period.timmar)}
          unit="h"
          note={
            <>
              <div>
                315: {fmtHours.format(period.nominell)} h · 483:{' '}
                {fmtHours.format(period.plus)} h · K315:{' '}
                {fmtHours.format(period.langdagTimmar)} h
              </div>
              <div>
                Semester: {fmtHours.format(period.semesterTimmar)} h (
                {fmtInt.format(period.semesterDagar)} × 5 h)
              </div>
            </>
          }
        />
        <StatCard
          label={over ? 'Över årsarbetstiden' : 'Kvar till 1825 h'}
          value={fmtHours.format(Math.abs(kvarTimmar))}
          unit="h"
          note={`Av ${fmtInt.format(ARSARBETSTID_TIMMAR)} h för perioden ${period.label}`}
          alert={over}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div className="text-sm font-medium">
            {period.label} — {period.startISO} till {period.endISO}
          </div>
          <div className="text-sm tabular-nums text-[#F5F7FF]/70">
            {fmtHours.format(period.timmar)} / {fmtInt.format(ARSARBETSTID_TIMMAR)} h
          </div>
        </div>

        <div
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(andel * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Andel av årsarbetstiden ${period.label}`}
        >
          <div
            className={[
              'h-full rounded-full transition-[width]',
              over ? 'bg-red-400' : 'bg-emerald-400',
            ].join(' ')}
            style={{ width: `${andel * 100}%` }}
          />
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-[#F5F7FF]/60 sm:grid-cols-2">
          <div>
            Arbetad tid (315 + 483 + K315):{' '}
            <span className="font-semibold text-[#F5F7FF]/85 tabular-nums">
              {fmtHours.format(period.arbetsTimmar)} h
            </span>{' '}
            på {fmtInt.format(period.arbetsDagar)} dagar
          </div>
          <div>
            Långdagstillägg (K315):{' '}
            <span className="font-semibold text-[#F5F7FF]/85 tabular-nums">
              {fmtHours.format(period.langdagTimmar)} h
            </span>{' '}
            på {fmtInt.format(period.langdagar)} dygn över 10,5 h
          </div>
          <div className="sm:text-right">
            Semester (700):{' '}
            <span className="font-semibold text-[#F5F7FF]/85 tabular-nums">
              {fmtHours.format(period.semesterTimmar)} h
            </span>{' '}
            på {fmtInt.format(period.semesterDagar)} dagar
          </div>
          <div className="sm:col-span-2">
            Enligt §5.2 ryms högst {fmtInt.format(ARSARBETSTID_TIMMAR)} h under
            högst {ARSARBETSTID_DAGAR} arbetsdagar per begränsningsperiod,
            inklusive semesterledighet (175 h och 35 semesterdagar). Varje
            semesterdag noteras som 5 h.
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  unit,
  note,
  alert,
}: {
  label: string;
  value: string;
  unit: string;
  note?: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="text-xs uppercase tracking-wide text-[#F5F7FF]/50">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={[
            'text-3xl font-semibold tabular-nums',
            alert ? 'text-red-300' : 'text-[#F5F7FF]',
          ].join(' ')}
        >
          {value}
        </span>
        <span className="text-sm text-[#F5F7FF]/60">{unit}</span>
      </div>
      {note ? (
        <div className="mt-1 space-y-0.5 text-xs text-[#F5F7FF]/60">{note}</div>
      ) : null}
    </div>
  );
}
