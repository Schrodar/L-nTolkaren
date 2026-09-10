'use client';

import * as React from 'react';

import {
  useAppContext,
  ALLOWANCES,
  type EmploymentType,
} from '@/components/AppContext';
import { SiteNav } from '@/components/SiteNav';
import { TariffEditor } from '@/components/TariffEditor';
import {
  calculateManualSalary,
  salaryRates,
} from '@/lib/salary/calculateMonthlySalary';

/**
 * Manuell löneräknare — fristående från kalendern.
 *
 * Kalendersidan räknar automatiskt ur AO och lönespec. Den här sidan är för
 * när man vill räkna själv: innan specen kommit, utan AO uppladdad, eller för
 * att pröva ett scenario. Inga månadsdata läses — allt kommer från fälten.
 *
 * Anställningsform, nivå och tillägg ligger kvar i de delade
 * löneinställningarna (AppContext) så att båda sidorna räknar med samma
 * tariff. Bara timmarna är sidans egna och sparas under nyckeln nedan.
 */
const LS_KEY = 'loneberakning:manuell.v1';

type ManuellState = {
  /** Steg 1 (anställningsform) avklarat — annars visas kom igång-rutan. */
  klar: boolean;
  /** Fälten hålls som text så att de går att tömma medan man skriver. */
  ordinarieTimmar: string;
  obTimmar: string;
  overtidVardag: string;
  overtidHelg: string;
  maskinDagar: string;
};

const TOMT: ManuellState = {
  klar: false,
  ordinarieTimmar: '',
  obTimmar: '',
  overtidVardag: '',
  overtidHelg: '',
  maskinDagar: '',
};

const ANSTALLNINGSFORMER: Array<{
  value: EmploymentType;
  label: string;
  beskrivning: string;
}> = [
  {
    value: 'monthly',
    label: 'Tillsvidare',
    beskrivning: 'Månadslön enligt tariffen — timmarna påverkar inte grundlönen.',
  },
  {
    value: 'hourlySeasonal',
    label: 'Timlön säsong',
    beskrivning: 'Säsong eller vikariat. Grundlönen är timmar × timlön.',
  },
  {
    value: 'hourlyShortTerm',
    label: 'Timlön korttid',
    beskrivning: 'Korttidsanställd. Grundlönen är timmar × timlön.',
  },
];

const fmtKr = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtTal = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

/** Kommatecken duger lika bra som punkt — folk skriver "7,5". */
function tillTal(text: string): number {
  const n = Number(text.replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function LoneberakningPage() {
  const {
    groundSalarySelection,
    setGroundSalarySelection,
    selectedTariff,
    activeAllowances,
    allowanceAmounts,
  } = useAppContext();

  // localStorage får inte läsas under render — det ger hydration-mismatch.
  const [state, setState] = React.useState<ManuellState | null>(null);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      setState(raw ? { ...TOMT, ...(JSON.parse(raw) as ManuellState) } : TOMT);
    } catch {
      setState(TOMT);
    }
  }, []);

  React.useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // Full disk eller blockerad lagring — beräkningen fungerar ändå.
    }
  }, [state]);

  const satser = salaryRates(selectedTariff, groundSalarySelection.tenure);

  const lon = React.useMemo(() => {
    if (!state) return null;
    return calculateManualSalary({
      tariff: selectedTariff,
      tenure: groundSalarySelection.tenure,
      employmentType: groundSalarySelection.employmentType,
      ordinaryHours: tillTal(state.ordinarieTimmar),
      obHours: tillTal(state.obTimmar),
      overtimeWeekdayHours: tillTal(state.overtidVardag),
      overtimeWeekendHours: tillTal(state.overtidHelg),
      engineAttendantDays: tillTal(state.maskinDagar),
      activeAllowances,
      allowanceAmounts,
    });
  }, [
    state,
    selectedTariff,
    groundSalarySelection,
    activeAllowances,
    allowanceAmounts,
  ]);

  const timlon =
    groundSalarySelection.employmentType === 'hourlySeasonal'
      ? selectedTariff.hourlySeasonal[groundSalarySelection.tenure]
      : groundSalarySelection.employmentType === 'hourlyShortTerm'
        ? selectedTariff.hourlyShortTerm[groundSalarySelection.tenure]
        : null;

  function satt(fält: keyof ManuellState, värde: string) {
    setState((prev) => (prev ? { ...prev, [fält]: värde } : prev));
  }

  return (
    <div className="min-h-dvh bg-[#0B1B3A] px-4 py-10 text-[#F5F7FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Löneberäkning
          </h1>
          <SiteNav />
        </header>

        <p className="mb-6 max-w-3xl text-sm text-[#F5F7FF]/70">
          Räkna ut bruttolönen för hand — välj anställningsform, tariff och
          tillägg och fyll i dina timmar. Sidan läser ingen AO och ingen
          lönespec, så den fungerar även innan specen kommit. Allt du skriver
          sparas i din webbläsare.
        </p>

        {state === null ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[#F5F7FF]/70">
            Läser sparade uppgifter…
          </div>
        ) : !state.klar ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Hur är du anställd?</h2>
            <p className="mt-1 text-sm text-[#F5F7FF]/70">
              Valet avgör hur grundlönen räknas. Du kan ändra det när som helst
              efteråt.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {ANSTALLNINGSFORMER.map((form) => (
                <button
                  key={form.value}
                  type="button"
                  onClick={() => {
                    setGroundSalarySelection({
                      ...groundSalarySelection,
                      employmentType: form.value,
                    });
                    setState((prev) => (prev ? { ...prev, klar: true } : prev));
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                >
                  <div className="text-base font-semibold">{form.label}</div>
                  <div className="mt-1 text-xs text-[#F5F7FF]/60">
                    {form.beskrivning}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            <TariffEditor />

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Timmar</h2>
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => (prev ? { ...prev, klar: false } : prev))
                  }
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-[#F5F7FF]/60 hover:bg-white/10"
                >
                  Byt anställningsform
                </button>
              </div>
              <p className="mb-4 text-xs text-[#F5F7FF]/60">
                Övertiden delas upp själv: vardag och fredag räknas med
                månadslön ÷ 104, lördag, söndag och helg med ÷ 72 (§6.3).
              </p>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Falt
                  etikett="Ordinarie timmar"
                  hjalp={
                    groundSalarySelection.employmentType === 'monthly'
                      ? 'Påverkar inte grundlönen vid månadslön'
                      : timlon
                        ? `${fmtKr.format(timlon)} kr/tim`
                        : undefined
                  }
                  varde={state.ordinarieTimmar}
                  onChange={(v) => satt('ordinarieTimmar', v)}
                />
                <Falt
                  etikett="OB-timmar"
                  hjalp={`${fmtKr.format(satser.obRatePerHour)} kr/tim`}
                  varde={state.obTimmar}
                  onChange={(v) => satt('obTimmar', v)}
                />
                <Falt
                  etikett="Övertid vardag"
                  hjalp={`${fmtKr.format(satser.otWeekdayRate)} kr/tim`}
                  varde={state.overtidVardag}
                  onChange={(v) => satt('overtidVardag', v)}
                />
                <Falt
                  etikett="Övertid helg"
                  hjalp={`${fmtKr.format(satser.otWeekendRate)} kr/tim`}
                  varde={state.overtidHelg}
                  onChange={(v) => satt('overtidHelg', v)}
                />
                <Falt
                  etikett="Maskinskötseldagar"
                  hjalp={`${fmtKr.format(allowanceAmounts['maskinskots'])} kr/dag`}
                  varde={state.maskinDagar}
                  onChange={(v) => satt('maskinDagar', v)}
                />
              </div>
            </section>

            {lon && (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold">Bruttolön</h2>

                <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
                  <Rad
                    etikett="Grundlön"
                    detalj={
                      groundSalarySelection.employmentType === 'monthly'
                        ? 'Månadslön enligt tariffen'
                        : `${fmtTal.format(tillTal(state.ordinarieTimmar))} h × ${fmtKr.format(timlon ?? 0)} kr`
                    }
                    belopp={lon.baseSalary}
                  />
                  <Rad
                    etikett="OB-ersättning"
                    detalj={`${fmtTal.format(lon.obHours)} h × ${fmtKr.format(satser.obRatePerHour)} kr`}
                    belopp={lon.obPay}
                  />
                  <Rad
                    etikett="Övertid vardag"
                    detalj={`${fmtTal.format(lon.overtimeWeekdayHours)} h × ${fmtKr.format(satser.otWeekdayRate)} kr`}
                    belopp={lon.overtimeWeekday}
                  />
                  <Rad
                    etikett="Övertid helg"
                    detalj={`${fmtTal.format(lon.overtimeWeekendHours)} h × ${fmtKr.format(satser.otWeekendRate)} kr`}
                    belopp={lon.overtimeWeekend}
                  />
                  <Rad
                    etikett="Maskinskötseltillägg"
                    detalj={`${fmtTal.format(lon.engineAttendantDays)} dagar × ${fmtKr.format(allowanceAmounts['maskinskots'])} kr`}
                    belopp={lon.engineAttendant}
                  />
                  <Rad
                    etikett="Rederitillägg"
                    detalj={
                      activeAllowances.has('rederi')
                        ? 'Fast belopp per månad'
                        : 'Inte aktiverat i Löneinställningar'
                    }
                    belopp={lon.rederiAllowance}
                  />
                  <Rad
                    etikett="Däckmanstillägg"
                    detalj={
                      activeAllowances.has('dackman')
                        ? 'Fast belopp per månad'
                        : 'Inte aktiverat i Löneinställningar'
                    }
                    belopp={lon.dackmanAllowance}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
                  <div className="text-sm font-semibold text-emerald-200">
                    Bruttolön
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-emerald-200">
                    {fmtKr.format(lon.total)} kr
                  </div>
                </div>

                <p className="mt-3 text-xs text-[#F5F7FF]/50">
                  Beloppet är före skatt och innehåller inga avdrag för
                  frånvaro. Tilläggen slås av och på under Löneinställningar —
                  {' '}
                  {ALLOWANCES.filter((a) => activeAllowances.has(a.key)).length}{' '}
                  av {ALLOWANCES.length} är aktiva just nu.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Falt({
  etikett,
  hjalp,
  varde,
  onChange,
}: {
  etikett: string;
  hjalp?: string;
  varde: string;
  onChange: (varde: string) => void;
}) {
  return (
    <label className="block text-sm text-[#F5F7FF]/90">
      {etikett}
      <input
        type="text"
        inputMode="decimal"
        value={varde}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1B3A] px-3 py-2 text-sm tabular-nums text-[#F5F7FF] placeholder:text-[#F5F7FF]/25"
      />
      {hjalp ? (
        <span className="mt-1 block text-xs text-[#F5F7FF]/50">{hjalp}</span>
      ) : null}
    </label>
  );
}

function Rad({
  etikett,
  detalj,
  belopp,
}: {
  etikett: string;
  detalj: string;
  belopp: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[#F5F7FF]/90">{etikett}</div>
        <div className="text-xs text-[#F5F7FF]/50">{detalj}</div>
      </div>
      <div
        className={`shrink-0 tabular-nums text-sm font-semibold ${
          belopp > 0 ? 'text-[#F5F7FF]' : 'text-[#F5F7FF]/35'
        }`}
      >
        {fmtKr.format(belopp)} kr
      </div>
    </div>
  );
}
