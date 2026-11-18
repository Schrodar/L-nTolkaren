/**
 * Tester för löneberäkningen.
 *
 * Avtalets delare låg tidigare utspridda: ÷300, ÷104 och ÷72 räknades fram
 * både i lib och i kalenderns vy, och ÷173 för sjukavdrag fanns bara i vyn.
 * Testerna låser fast satserna på ett ställe så att de inte kan glida isär,
 * och att de två ingångarna — manuell inmatning och dagrader från AO — ger
 * samma svar på samma underlag.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateManualSalary,
  calculateMonthlySalary,
  hourlyRate,
  fixedMonthlySupplements,
  salaryRates,
  type DaySalaryInput,
} from "./calculateMonthlySalary.ts";
import { DEFAULT_TARIFFS } from "../tariffs/defaultTariffs.ts";

const tariff = Object.values(DEFAULT_TARIFFS)[0];
const tenure = "y5" as const;
const belopp = { maskinskots: 165, rederi: 655, dackman: 2721 };
const inga = new Set<never>();

const nara = (a: number, b: number, vad: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${vad}: ${a} ≠ ${b}`);

// ── Satserna ────────────────────────────────────────────────────────────────

test("satserna följer avtalets delare", () => {
  const m = tariff.monthly[tenure];
  const s = salaryRates(tariff, tenure);

  nara(s.monthlyRate, m, "månadslön");
  nara(s.obRatePerHour, m / 300, "OB §7");
  nara(s.otWeekdayRate, m / 104, "övertid vardag §6.3");
  nara(s.otWeekendRate, m / 72, "övertid helg §6.3");
  nara(s.sickRatePerHour, m / 173, "sjukavdrag");
});

test("komp som tas ut kontant värderas som övertid", () => {
  const s = salaryRates(tariff, tenure);
  nara(s.kompWeekdayRate, s.otWeekdayRate, "komp vardag");
  nara(s.kompWeekendRate, s.otWeekendRate, "komp helg");
});

test("timlön finns bara för timanställda", () => {
  assert.equal(hourlyRate(tariff, tenure, "monthly"), null);
  assert.equal(
    hourlyRate(tariff, tenure, "hourlySeasonal"),
    tariff.hourlySeasonal[tenure]
  );
  assert.equal(
    hourlyRate(tariff, tenure, "hourlyShortTerm"),
    tariff.hourlyShortTerm[tenure]
  );
});

// ── Manuell beräkning ───────────────────────────────────────────────────────

test("manuell beräkning: varje post räknas med sin egen sats", () => {
  // Tilläggen nedan är aktiva, så satserna utgår från tarifflön + 3 376 kr.
  const s = salaryRates(
    tariff,
    tenure,
    fixedMonthlySupplements(new Set(["rederi", "dackman"]), belopp)
  );
  const ut = calculateManualSalary({
    tariff,
    tenure,
    employmentType: "monthly",
    ordinaryHours: 150,
    obHours: 10,
    overtimeWeekdayHours: 5,
    overtimeWeekendHours: 2,
    engineAttendantDays: 3,
    kompCashHours: 0,
    activeAllowances: new Set(["rederi", "dackman"]),
    allowanceAmounts: belopp,
  });

  // Grundlönen är tarifflönen. Tilläggen höjer timsatserna men står som
  // egna rader i lönen — de läggs inte in i grundlönen.
  nara(ut.baseSalary, tariff.monthly[tenure], "grundlön");
  nara(s.monthlyRate, tariff.monthly[tenure] + 3376, "satsbas");
  nara(ut.obPay, 10 * s.obRatePerHour, "OB");
  nara(ut.overtimeWeekday, 5 * s.otWeekdayRate, "övertid vardag");
  nara(ut.overtimeWeekend, 2 * s.otWeekendRate, "övertid helg");
  nara(ut.engineAttendant, 3 * 165, "maskinskötsel");
  nara(ut.rederiAllowance, 655, "rederitillägg");
  nara(ut.dackmanAllowance, 2721, "däckmanstillägg");
  nara(
    ut.total,
    ut.baseSalary +
      ut.obPay +
      ut.overtimeWeekday +
      ut.overtimeWeekend +
      ut.engineAttendant +
      ut.rederiAllowance +
      ut.dackmanAllowance,
    "bruttolön"
  );
});

test("timanställd får grundlönen som timmar × timlön", () => {
  const ut = calculateManualSalary({
    tariff,
    tenure,
    employmentType: "hourlySeasonal",
    ordinaryHours: 150,
    obHours: 0,
    overtimeWeekdayHours: 0,
    overtimeWeekendHours: 0,
    engineAttendantDays: 0,
    kompCashHours: 0,
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });
  nara(ut.baseSalary, 150 * tariff.hourlySeasonal[tenure], "grundlön timlön");
});

test("OB-satsen utgår från månadslönen även när grundlönen är timbaserad", () => {
  // Visningen i kalendern delade tidigare grundlönen med 300, vilket blev
  // fel så fort grundlönen inte var månadslönen.
  const s = salaryRates(tariff, tenure);
  const ut = calculateManualSalary({
    tariff,
    tenure,
    employmentType: "hourlySeasonal",
    ordinaryHours: 150,
    obHours: 10,
    overtimeWeekdayHours: 0,
    overtimeWeekendHours: 0,
    engineAttendantDays: 0,
    kompCashHours: 0,
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });

  nara(ut.obPay, 10 * s.obRatePerHour, "OB ur månadslönen");
  assert.ok(
    Math.abs(ut.obPay - 10 * (ut.baseSalary / 300)) > 1,
    "grundlönen/300 är en annan sats — det var just felet"
  );
});

// ── De två ingångarna ───────────────────────────────────────────────────────

test("dagrader och manuell inmatning ger samma lön på samma underlag", () => {
  // En onsdag utan klockslag: OB faller tillbaka på dagtyp och blir noll,
  // så de två vägarna är jämförbara post för post.
  const dagar: DaySalaryInput[] = [
    {
      dateISO: "2026-07-08",
      aoHours: 8,
      manualHours: 0,
      shifts: [],
      overtimeHours: 2,
      engineAttendantDays: 1,
    },
  ];

  // Utan fasta tillägg utgår båda vägarna från samma bas.
  const auto = calculateMonthlySalary({
    tariff,
    tenure,
    employmentType: "monthly",
    days: dagar,
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });

  const manuell = calculateManualSalary({
    tariff,
    tenure,
    employmentType: "monthly",
    ordinaryHours: 8,
    obHours: auto.obHours,
    overtimeWeekdayHours: auto.overtimeWeekdayHours,
    overtimeWeekendHours: auto.overtimeWeekendHours,
    engineAttendantDays: 1,
    kompCashHours: 0,
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });

  nara(manuell.total, auto.total, "bruttolön");
  nara(manuell.baseSalary, auto.baseSalary, "grundlön");
  nara(manuell.overtimeWeekday, auto.overtimeWeekday, "övertid");
});

test("med fasta tillägg skiljer sig vägarna — kalendern använder ännu smal bas", () => {
  // Dokumenterar ett känt glapp: den manuella räknaren lägger de fasta
  // tilläggen i basen (verifierat mot lönespec), medan den automatiska
  // kalenderberäkningen ännu räknar på enbart tarifflönen.
  const medTillagg = new Set(["rederi", "dackman"] as const);
  const dagar: DaySalaryInput[] = [
    {
      dateISO: "2026-07-08",
      aoHours: 8,
      manualHours: 0,
      shifts: [],
      overtimeHours: 2,
      engineAttendantDays: 0,
    },
  ];

  const auto = calculateMonthlySalary({
    tariff,
    tenure,
    employmentType: "monthly",
    days: dagar,
    activeAllowances: medTillagg,
    allowanceAmounts: belopp,
  });

  const manuell = calculateManualSalary({
    tariff,
    tenure,
    employmentType: "monthly",
    ordinaryHours: 8,
    obHours: 0,
    overtimeWeekdayHours: 2,
    overtimeWeekendHours: 0,
    engineAttendantDays: 0,
    kompCashHours: 0,
    activeAllowances: medTillagg,
    allowanceAmounts: belopp,
  });

  const smal = salaryRates(tariff, tenure);
  const bred = salaryRates(tariff, tenure, 3376);

  nara(auto.overtimeWeekday, 2 * smal.otWeekdayRate, "kalendern: smal bas");
  nara(manuell.overtimeWeekday, 2 * bred.otWeekdayRate, "manuellt: bred bas");
  assert.ok(
    manuell.overtimeWeekday > auto.overtimeWeekday,
    "den breda basen ger högre övertidsersättning"
  );
});

test("övertid på lördag värderas med helgsatsen", () => {
  const s = salaryRates(tariff, tenure);
  const lordag = calculateMonthlySalary({
    tariff,
    tenure,
    employmentType: "monthly",
    days: [
      {
        dateISO: "2026-07-11", // lördag
        aoHours: 8,
        manualHours: 0,
        shifts: [],
        overtimeHours: 3,
        engineAttendantDays: 0,
      },
    ],
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });

  nara(lordag.overtimeWeekendHours, 3, "helgtimmar");
  nara(lordag.overtimeWeekdayHours, 0, "inga vardagstimmar");
  nara(lordag.overtimeWeekend, 3 * s.otWeekendRate, "helgsats");
});

// ── Basen som delarna tillämpas på ──────────────────────────────────────────

test("fasta månadstillägg räknas in i basen, maskinskötsel gör det inte", () => {
  const belopp2 = { maskinskots: 165, rederi: 655, dackman: 2721 };

  assert.equal(fixedMonthlySupplements(inga, belopp2), 0);
  assert.equal(
    fixedMonthlySupplements(new Set(["rederi"]), belopp2),
    655
  );
  assert.equal(
    fixedMonthlySupplements(new Set(["rederi", "dackman"]), belopp2),
    3376
  );
  assert.equal(
    fixedMonthlySupplements(new Set(["maskinskots"]), belopp2),
    0,
    "maskinskötsel är kr/dag och hör inte till månadsbasen"
  );
});

test("satserna stämmer med en verklig lönespec", () => {
  // Johans augustispec 2026: månadslön 33 724 + däckman 2 721 + rederi 655.
  // Arbetsgivarens egna satser på den specen: art 320 (komp till pengar)
  // 244,08 kr/h och art 301 (övertid) 356,73 kr/h.
  const spec = {
    monthly: { ...tariff.monthly, y5: 33724 },
    hourlySeasonal: tariff.hourlySeasonal,
    hourlyShortTerm: tariff.hourlyShortTerm,
    supplements: tariff.supplements,
    hourDivisors: tariff.hourDivisors,
    effectiveFrom: tariff.effectiveFrom,
  };
  const belopp2 = { maskinskots: 165, rederi: 655, dackman: 2721 };
  const extra = fixedMonthlySupplements(
    new Set(["rederi", "dackman"]),
    belopp2
  );
  assert.equal(extra, 3376);

  const s = salaryRates(spec, "y5", extra);
  assert.equal(s.monthlyRate, 37100, "basen");
  assert.equal(s.kompCashRate.toFixed(2), "244.08", "art 320");
  assert.equal(s.otWeekdayRate.toFixed(2), "356.73", "art 301");

  // Specens belopp: 45,00 h × 244,08 = 10 983,55
  assert.equal((45 * s.kompCashRate).toFixed(2), "10983.55");
  // Specens belopp: 0,50 h × 356,73 = 178,37
  assert.equal((0.5 * s.otWeekdayRate).toFixed(2), "178.37");
});

test("utan tillägg är basen bara tarifflönen", () => {
  const utan = salaryRates(tariff, tenure);
  const noll = salaryRates(tariff, tenure, 0);
  assert.equal(utan.monthlyRate, tariff.monthly[tenure]);
  assert.equal(noll.monthlyRate, utan.monthlyRate);
});

// ── Uttagen komptid (§11.3) ─────────────────────────────────────────────────

test("komptid som tas ut kontant värderas med månadslön ÷ 152", () => {
  const m = tariff.monthly[tenure];
  const s = salaryRates(tariff, tenure);
  nara(s.kompCashRate, m / 152, "§11.3");

  // Satsen är densamma som tariffens ordinarie timlön — avtalet säger att
  // "ordinarie timlön utgår från gällande månadslön dividerat med 152".
  // Tariffens tal är den publicerade, öresavrundade siffran (204,12 mot
  // 204,1184), så jämförelsen går på örat och inte på sista decimalen.
  assert.ok(
    Math.abs(s.kompCashRate - tariff.hourlySeasonal[tenure]) < 0.01,
    `ordinarie timlön: ${s.kompCashRate} mot tariffens ${tariff.hourlySeasonal[tenure]}`
  );
});

test("uttagen komptid läggs till bruttolönen utan att räknas upp", () => {
  const s = salaryRates(tariff, tenure);
  const bas = {
    tariff,
    tenure,
    employmentType: "monthly" as const,
    ordinaryHours: 0,
    obHours: 0,
    overtimeWeekdayHours: 0,
    overtimeWeekendHours: 0,
    engineAttendantDays: 0,
    activeAllowances: inga,
    allowanceAmounts: belopp,
  };

  const utan = calculateManualSalary({ ...bas, kompCashHours: 0 });
  const med = calculateManualSalary({ ...bas, kompCashHours: 22 });

  nara(med.kompCashHours, 22, "timmar");
  nara(med.kompCashPay, 22 * s.kompCashRate, "belopp");
  nara(med.total - utan.total, 22 * s.kompCashRate, "påverkan på brutto");

  // Timmarna i saldot är redan uppräknade enligt §6.3 när de tjänades in,
  // så här ska ingen faktor 1,4 eller 2 appliceras igen.
  assert.ok(
    Math.abs(med.kompCashPay - 22 * 1.4 * s.kompCashRate) > 1,
    "ingen dubbel uppräkning"
  );
});

test("den automatiska beräkningen rör inte komputtaget", () => {
  const auto = calculateMonthlySalary({
    tariff,
    tenure,
    employmentType: "monthly",
    days: [
      {
        dateISO: "2026-07-08",
        aoHours: 8,
        manualHours: 0,
        shifts: [],
        overtimeHours: 0,
        engineAttendantDays: 0,
      },
    ],
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });

  assert.equal(auto.kompCashPay, 0);
  assert.equal(auto.kompCashHours, 0);
  nara(auto.total, tariff.monthly[tenure], "bruttolönen oförändrad");
});

test("tillägg som inte är aktiverade ger noll", () => {
  const ut = calculateManualSalary({
    tariff,
    tenure,
    employmentType: "monthly",
    ordinaryHours: 0,
    obHours: 0,
    overtimeWeekdayHours: 0,
    overtimeWeekendHours: 0,
    engineAttendantDays: 0,
    kompCashHours: 0,
    activeAllowances: inga,
    allowanceAmounts: belopp,
  });
  assert.equal(ut.rederiAllowance, 0);
  assert.equal(ut.dackmanAllowance, 0);
  assert.equal(ut.engineAttendant, 0);
  nara(ut.total, tariff.monthly[tenure], "bara grundlönen kvar");
});
