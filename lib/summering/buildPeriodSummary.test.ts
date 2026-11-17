/**
 * Tester för summeringen per begränsningsperiod.
 *
 * Körs med Nodes inbyggda testkörare, som läser TypeScript direkt:
 *   npm test
 *
 * Bakgrund: augusti 2026 saknades helt i tabellen "Per månad" på
 * /summering. Månadsraderna byggdes ur de datum som fanns i sparade
 * lönespecar, så en månad utan inläst spec föll tyst ur serien. Testerna
 * nedan låser fast att hål i serien syns och att de går att skilja från en
 * månad som är inläst men saknar arbetad tid.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ARSARBETSTID_TIMMAR,
  buildPeriodSummaries,
  periodStartYear,
} from "./buildPeriodSummary.ts";

type Timmar = Record<string, number>;

/**
 * Bygger en sparad lönespec. `monthISO` är arbetsmånaden, alltså månaden
 * före utbetalningsmånaden.
 */
function spec(opts: {
  monthISO: string | null;
  fileName?: string;
  savedAt?: string;
  nominell?: Timmar;
  plus?: Timmar;
  langdag?: Timmar;
  semesterDatum?: string[];
}) {
  return {
    fileName: opts.fileName ?? `${opts.monthISO}.pdf`,
    monthISO: opts.monthISO,
    employeeName: "Testperson",
    savedAt: opts.savedAt ?? "2026-01-01T00:00:00.000Z",
    overview: {
      ...(opts.nominell
        ? {
            art315: {
              art: "315",
              hoursByDateISO: opts.nominell,
              datesISO: Object.keys(opts.nominell),
            },
          }
        : {}),
      ...(opts.plus
        ? { art483: { art: "483", hoursByDateISO: opts.plus } }
        : {}),
      ...(opts.langdag
        ? { artK315: { art: "K315", hoursByDateISO: opts.langdag } }
        : {}),
      ...(opts.semesterDatum
        ? { art700: { art: "700", datesISO: opts.semesterDatum } }
        : {}),
    },
  } as unknown as Parameters<typeof buildPeriodSummaries>[0][number];
}

/** Hela månaden som arbetsdagar à `timmar`, måndag–fredag räknas inte — alla dagar tas. */
function manadsTimmar(monthISO: string, dagar: number[], timmar: number): Timmar {
  const ut: Timmar = {};
  for (const d of dagar) {
    ut[`${monthISO}-${String(d).padStart(2, "0")}`] = timmar;
  }
  return ut;
}

const manader = (p: { manader: Array<{ monthISO: string }> }) =>
  p.manader.map((m) => m.monthISO);

// ── Begränsningsperioden ────────────────────────────────────────────────────

test("begränsningsperioden börjar 1 april", () => {
  assert.equal(periodStartYear("2026-04-01"), 2026);
  assert.equal(periodStartYear("2026-08-15"), 2026);
  assert.equal(periodStartYear("2027-03-31"), 2026);
  assert.equal(periodStartYear("2026-03-31"), 2025);
});

// ── 1. Arbetstid i samtliga månader ─────────────────────────────────────────

test("en period med arbete varje månad ger en rad per månad, kronologiskt", () => {
  const specar = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].map(
    (m) => spec({ monthISO: m, nominell: manadsTimmar(m, [1, 2, 3], 8) })
  );

  const [period] = buildPeriodSummaries(specar);

  assert.deepEqual(manader(period), [
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
  ]);
  assert.equal(period.manader.every((m) => !m.saknasImport), true);
  assert.equal(period.dagar, 15);
  assert.equal(period.timmar, 120);
});

// ── 2 + 4. Hål i serien, och skillnaden mot noll timmar ─────────────────────

test("en månad utan inläst spec blir en egen rad märkt saknasImport", () => {
  const [period] = buildPeriodSummaries([
    spec({ monthISO: "2026-07", nominell: manadsTimmar("2026-07", [6, 7], 9) }),
    spec({ monthISO: "2026-09", nominell: manadsTimmar("2026-09", [1, 2], 9) }),
  ]);

  assert.deepEqual(manader(period), ["2026-07", "2026-08", "2026-09"]);

  const augusti = period.manader.find((m) => m.monthISO === "2026-08")!;
  assert.equal(augusti.saknasImport, true);
  assert.equal(augusti.dagar, 0);
  assert.equal(augusti.total, 0);

  // Hålet får inte påverka summorna
  assert.equal(period.dagar, 4);
  assert.equal(period.timmar, 36);
});

test("en inläst månad utan arbetad tid skiljs från en månad utan spec", () => {
  const [period] = buildPeriodSummaries([
    spec({ monthISO: "2026-04", nominell: manadsTimmar("2026-04", [1], 8) }),
    // Maj är inläst men varenda dag gav noll timmar
    spec({ monthISO: "2026-05", nominell: { "2026-05-01": 0, "2026-05-02": 0 } }),
    spec({ monthISO: "2026-07", nominell: manadsTimmar("2026-07", [1], 8) }),
  ]);

  const maj = period.manader.find((m) => m.monthISO === "2026-05")!;
  const juni = period.manader.find((m) => m.monthISO === "2026-06")!;

  assert.equal(maj.saknasImport, false, "maj är inläst, bara tom");
  assert.equal(maj.total, 0);
  assert.equal(juni.saknasImport, true, "juni har ingen spec alls");
});

// ── 3. Augusti med riktiga registreringar ───────────────────────────────────

test("augusti redovisas med sina timmar när specen finns", () => {
  const [period] = buildPeriodSummaries([
    spec({ monthISO: "2026-07", nominell: manadsTimmar("2026-07", [6], 9) }),
    spec({
      monthISO: "2026-08",
      nominell: manadsTimmar("2026-08", [3, 4, 5], 10.5),
      plus: { "2026-08-05": 2 },
      langdag: { "2026-08-05": 0.8 },
    }),
    spec({ monthISO: "2026-09", nominell: manadsTimmar("2026-09", [1], 9) }),
  ]);

  const augusti = period.manader.find((m) => m.monthISO === "2026-08")!;
  assert.equal(augusti.saknasImport, false);
  assert.equal(augusti.arbetsDagar, 3);
  assert.equal(augusti.nominell, 31.5);
  assert.equal(augusti.plus, 2);
  assert.equal(augusti.langdagTimmar, 0.8);
  assert.equal(augusti.total, 34.3);
  assert.deepEqual(manader(period), ["2026-07", "2026-08", "2026-09"]);
});

// ── 5. Utbetalningsmånad ≠ arbetsmånad ──────────────────────────────────────

test("timmarna hamnar på arbetsmånaden, inte på specens utbetalningsmånad", () => {
  // Septemberspecen avser augustis arbete. monthISO är satt till augusti,
  // men datumen är det som styr var timmarna hamnar.
  const [period] = buildPeriodSummaries([
    spec({
      monthISO: "2026-08",
      fileName: "Lonespecifikation 202609.pdf",
      nominell: manadsTimmar("2026-08", [10, 11], 9),
    }),
  ]);

  assert.deepEqual(manader(period), ["2026-08"]);
  assert.equal(period.manader[0].arbetsDagar, 2);
  assert.equal(period.manader[0].total, 18);
});

test("en spec vars datum spänner över två månader delas på arbetsmånad", () => {
  const [period] = buildPeriodSummaries([
    spec({
      monthISO: "2026-07",
      nominell: { "2026-07-31": 9, "2026-08-01": 9, "2026-08-02": 9 },
    }),
  ]);

  assert.deepEqual(manader(period), ["2026-07", "2026-08"]);
  assert.equal(period.manader[0].total, 9);
  assert.equal(period.manader[1].total, 18);
});

// ── 6. Summering efter gruppering ───────────────────────────────────────────

test("periodsumman är summan av månadsraderna", () => {
  const [period] = buildPeriodSummaries([
    spec({
      monthISO: "2026-04",
      nominell: manadsTimmar("2026-04", [1, 2], 10.5),
      plus: { "2026-04-02": 2.25 },
      langdag: { "2026-04-02": 0.9 },
    }),
    spec({
      monthISO: "2026-06",
      nominell: manadsTimmar("2026-06", [1], 8),
      semesterDatum: ["2026-06-10", "2026-06-11"],
    }),
  ]);

  const summaManader = period.manader.reduce((s, m) => s + m.total, 0);
  assert.ok(Math.abs(summaManader - period.timmar) < 1e-9);

  const summaDagar = period.manader.reduce((s, m) => s + m.dagar, 0);
  assert.equal(summaDagar, period.dagar);

  // Semester: 2 dagar à 5 h, och de räknas som dagar men inte som arbetsdagar
  assert.equal(period.semesterDagar, 2);
  assert.equal(period.semesterTimmar, 10);
  assert.equal(period.arbetsDagar, 3);
  assert.equal(period.dagar, 5);
  assert.equal(period.timmar, 10.5 + 10.5 + 2.25 + 0.9 + 8 + 10);
});

test("semester på en dag som redan har arbetad tid dubbelräknas inte", () => {
  const [period] = buildPeriodSummaries([
    spec({
      monthISO: "2026-04",
      nominell: { "2026-04-01": 8 },
      semesterDatum: ["2026-04-01", "2026-04-02"],
    }),
  ]);

  assert.equal(period.dagar, 2, "1 arbetsdag + 1 semesterdag");
  assert.equal(period.arbetsDagar, 1);
  assert.equal(period.semesterDagar, 1);
  assert.equal(period.timmar, 13);
});

test("samma månad importerad två gånger räknas en gång", () => {
  const timmar = manadsTimmar("2026-08", [3, 4], 9);
  const [period] = buildPeriodSummaries([
    spec({ monthISO: "2026-08", nominell: timmar, savedAt: "2026-09-25T00:00:00Z" }),
    spec({ monthISO: "2026-08", nominell: timmar, savedAt: "2026-09-26T00:00:00Z" }),
  ]);

  assert.equal(period.dagar, 2);
  assert.equal(period.timmar, 18);
});

test("timmarna ligger kvar under taket på 1825 h", () => {
  const [period] = buildPeriodSummaries([
    spec({ monthISO: "2026-08", nominell: manadsTimmar("2026-08", [1, 2], 9) }),
  ]);
  assert.ok(period.timmar < ARSARBETSTID_TIMMAR);
});

// ── Perioder ────────────────────────────────────────────────────────────────

test("arbete i mars och april hamnar i olika begränsningsperioder", () => {
  const perioder = buildPeriodSummaries([
    spec({ monthISO: "2026-03", nominell: { "2026-03-30": 8 } }),
    spec({ monthISO: "2026-04", nominell: { "2026-04-02": 8 } }),
  ]);

  assert.equal(perioder.length, 2);
  // Nyaste perioden först
  assert.equal(perioder[0].startYear, 2026);
  assert.equal(perioder[1].startYear, 2025);
  // Hålfyllningen får inte spilla över mellan perioder
  assert.deepEqual(manader(perioder[0]), ["2026-04"]);
  assert.deepEqual(manader(perioder[1]), ["2026-03"]);
});
