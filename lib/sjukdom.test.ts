/**
 * Tester för sjukfrånvaro på lönespecen, och för art-rader som bryts över
 * flera rader.
 *
 * Körs med Nodes inbyggda testkörare, som läser TypeScript direkt:
 *   npm test
 *
 * Bakgrund: en korttidsanställds spec visade fel sjukdagar. Kalendern
 * markerade bara art80001 ("Sjukdom karenstillfälle"), som täcker de första
 * timmarna av frånvaron — resten av sjukperioden ligger på art80002
 * ("Sjukdom dag 2-14"). En frånvaro 16–21 september renderades därför med
 * 18–21 som vanliga arbetsdagar. Själva frånvarotiden står på art800.
 *
 * Samma spec avslöjade ett andra fel: den har en "Slutlön"-sektion där
 * art-raden saknar både datum och belopp, som i stället står på nästa rad.
 * Hela slutlönen (21 951,76 kr) föll då ur bruttolönen.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractArtLines,
  extractSections,
  extractSpecTotals,
  groupByArt,
} from "./parsePayslipArtGroups.ts";
import { summarizePayslipArtGroups } from "./summarizePayslipArtGroups.ts";

/** Gör om spec-text till det som pdf.js-pipelinen hade levererat. */
function parse(text: string) {
  const lines = text
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => ({ y: -i, text: t }));
  const groups = groupByArt(extractArtLines(lines));
  return summarizePayslipArtGroups(groups, {
    sections: extractSections(lines),
    totals: extractSpecTotals(lines),
  });
}

/** Avrundning till öre, för jämförelser mot specens belopp. */
const ore = (n: number) => Math.round(n * 100) / 100;

// ── Sjukfrånvaro ──────────────────────────────────────────────────────────

/**
 * Utdrag ur den riktiga specen. Frånvaron 16–21 september ligger på två
 * art800-rader: en enskild dag och ett femdagarsintervall som klumpsumma.
 * Karensen (80001) spänner bara 16–17.
 */
const SJUKSPEC = `
070 Månadslön 2026-10-01 - 2026-10-31 27 396,00
315 Årsarbetstid, nominell tid 2026-09-16 - 2026-09-16 2,58 0,00
315 Årsarbetstid, nominell tid 2026-09-17 - 2026-09-17 11,58 0,00
315 Årsarbetstid, nominell tid 2026-09-18 - 2026-09-18 14,00 0,00
315 Årsarbetstid, nominell tid 2026-09-19 - 2026-09-19 14,00 0,00
315 Årsarbetstid, nominell tid 2026-09-20 - 2026-09-20 13,33 0,00
315 Årsarbetstid, nominell tid 2026-09-21 - 2026-09-21 5,83 0,00
483 Årsarbetstid SEKO, plustid 2026-09-21 - 2026-09-21 1,00 0,00
800 Sjukdom 2026-09-16 - 2026-09-16 2,58 Tim 24,76% 0,00
800 Sjukdom 2026-09-17 - 2026-09-21 59,74 Tim 0,00
80001 Sjukdom karenstillfälle 2026-09-16 - 2026-09-17 7,00 Tim -174,94 -1 224,59
80002 Sjukdom dag 2-14 2026-09-17 - 2026-09-21 55,32 Tim -34,99 -1 935,53
806 Sjuk OB 2026-09-21 - 2026-09-21 0,75 70,91 53,18
`;

test("art800 täcker hela sjukperioden, inte bara karensen", () => {
  const ov = parse(SJUKSPEC);

  assert.ok(ov.art800, "art800 ska tolkas");
  assert.deepEqual(ov.art800.datesISO, [
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
    "2026-09-21",
  ]);
  assert.equal(ov.art800.hoursTotal, 62.32);

  // Karensen täcker bara de två första dagarna — det var felet.
  assert.deepEqual(ov.art80001?.datesISO, ["2026-09-16", "2026-09-17"]);
});

test("flerdagarsintervallet behålls obearbetat för kalenderns AO-fördelning", () => {
  const ov = parse(SJUKSPEC);

  assert.deepEqual(ov.art800?.rangesISO, [
    { from: "2026-09-16", to: "2026-09-16", hours: 2.58 },
    { from: "2026-09-17", to: "2026-09-21", hours: 59.74 },
  ]);
});

test("sjuktimmar per dag viktas mot nominell tid, inte jämnt", () => {
  const ov = parse(SJUKSPEC);
  const perDag = ov.art800?.hoursByDateISO ?? {};

  // Den nominella tiden ligger kvar under sjukdomen, så frånvaron per dag
  // är exakt art315 + plustid. 21 september har 5,83 + 1,00 h — en jämn
  // fördelning hade lagt 59,74 / 5 = 11,95 h där.
  assert.equal(ore(perDag["2026-09-16"]), 2.58);
  assert.equal(ore(perDag["2026-09-17"]), 11.58);
  assert.equal(ore(perDag["2026-09-18"]), 14);
  assert.equal(ore(perDag["2026-09-19"]), 14);
  assert.equal(ore(perDag["2026-09-20"]), 13.33);
  assert.equal(ore(perDag["2026-09-21"]), 6.83);

  // Intervallets summa bevaras.
  const summa = Object.values(perDag).reduce((s, h) => s + h, 0);
  assert.equal(ore(summa), 62.32);
});

test("sjukavdraget läses från specen: karens full timlön, dag 2-14 tjugo procent", () => {
  const ov = parse(SJUKSPEC);

  // Karensen och dag 2-14 har olika timpris (174,94 mot 34,99 = 20 %), så
  // ett eget framräknat timpris kan inte träffa båda. Beloppen tas rakt av.
  assert.equal(ov.art80001?.sekTotalFromRow, -1224.59);
  assert.equal(ov.art80002?.sekTotal, -1935.53);

  // Timmarna delas mellan de två avdragen och summerar till art800.
  assert.equal(ore((ov.art80001?.hoursTotal ?? 0) + 55.32), 62.32);

  // Sjuk-OB är en intäkt under frånvaron.
  assert.equal(ov.art806?.sekTotal, 53.18);
});

test("sjukavdragen ingår i bruttolönen", () => {
  const ov = parse(SJUKSPEC);
  const brutto = ov.lonebesked?.bruttoBerakat ?? 0;

  // 27 396,00 − 1 224,59 − 1 935,53 + 53,18
  assert.equal(ore(brutto), 24289.06);
});

test("spec utan art800 faller tillbaka på karensdagarna", () => {
  const ov = parse(`
070 Månadslön 2026-10-01 - 2026-10-31 27 396,00
80001 Sjukdom karenstillfälle 2026-09-16 - 2026-09-16 7,00 Tim -174,94 -1 224,59
`);

  assert.equal(ov.art800, undefined);
  assert.deepEqual(ov.art80001?.datesISO, ["2026-09-16"]);
});

// ── Art-rader som bryts över flera rader ──────────────────────────────────

test("art-rad utan datum och belopp hämtar dem från nästa rad", () => {
  // Så ser slutlönesektionen ut i PDF:en: arten står ensam på sin rad med
  // en underrubrik emellan, och datum och belopp kommer på raden efter.
  const ov = parse(`
301 Övertid
Slutlön årsarbetstid
2026-09-01 - 2026-09-01 40,69 255,68 10 403,73
9991 Bruttolön 10 403,73
`);

  assert.deepEqual(ov.art301?.hoursByDateISO, { "2026-09-01": 40.69 });

  // sekTotalComputed är timmar × á-pris (40,69 × 255,68 = 10 403,62), medan
  // specen trycker ett avrundat belopp — därför ören i marginal.
  assert.ok(
    Math.abs((ov.art301?.sekTotalComputed ?? 0) - 10403.73) < 0.5,
    `oväntat belopp: ${ov.art301?.sekTotalComputed}`,
  );
  assert.ok(
    Math.abs((ov.lonebesked?.bruttoBerakat ?? 0) - 10403.73) < 0.5,
    `oväntad bruttolön: ${ov.lonebesked?.bruttoBerakat}`,
  );
});

test("art-rad som redan har datum och belopp slukar inte nästa rad", () => {
  const ov = parse(`
301 Övertid 2026-09-15 - 2026-09-15 1,58 255,68 403,98
302 Övertid, kvalificerad 2026-09-16 - 2026-09-16 2,00 300,00 600,00
`);

  // Varje art behåller sin egen dag — hade 301 slukat 302-raden hade
  // 2026-09-16 hamnat på 301 och 302 blivit tom.
  assert.deepEqual(ov.art301?.hoursByDateISO, { "2026-09-15": 1.58 });
  assert.deepEqual(ov.art302?.hoursByDateISO, { "2026-09-16": 2 });
  assert.equal(ore(ov.art302?.sekTotalComputed ?? 0), 600);
});

// ── Bruttolönen summeras ur raderna, aldrig ur art9991 ────────────────────

/**
 * Samma spec två gånger: en med korrekt art9991 och en där 9991 är satt till
 * ett orimligt tal. Beloppen ska vara identiska — 9991 får aldrig påverka
 * vad appen räknar fram, bara jämföras mot.
 */
const RADER = `
070 Månadslön 2026-10-01 - 2026-10-31 20 000,00
301 Övertid 2026-09-15 - 2026-09-15 10,00 100,00 1 000,00
9001 Tabellskatt -5 000,00
960 Fackföreningsavgift -300,00
`;

test("bruttolönen är summan av raderna", () => {
  const ov = parse(`${RADER}9991 Bruttolön 21 000,00\n`);

  assert.equal(ov.lonebesked?.bruttoBerakat, 21000);
  assert.equal(ov.lonebesked?.bruttoAvvikelse, 0);
  // 21 000 − 5 000 − 300
  assert.equal(ov.lonebesked?.netto, 15700);
});

test("ett felaktigt art9991 ändrar varken brutto eller netto", () => {
  const riktig = parse(`${RADER}9991 Bruttolön 21 000,00\n`);
  const trasig = parse(`${RADER}9991 Bruttolön 99 999,00\n`);

  assert.equal(trasig.lonebesked?.bruttoBerakat, riktig.lonebesked?.bruttoBerakat);
  assert.equal(trasig.lonebesked?.netto, riktig.lonebesked?.netto);

  // Skillnaden rapporteras i stället för att tyst tas över.
  assert.equal(trasig.lonebesked?.bruttoFranSpec, 99999);
  assert.equal(trasig.lonebesked?.bruttoAvvikelse, -78999);
});

test("en missad intäktsart syns som en avvikelse mot art9991", () => {
  // Specen säger 21 000 men vi har bara hittat rader för 20 000.
  const ov = parse(`
070 Månadslön 2026-10-01 - 2026-10-31 20 000,00
9001 Tabellskatt -5 000,00
9991 Bruttolön 21 000,00
`);

  assert.equal(ov.lonebesked?.bruttoBerakat, 20000);
  assert.equal(ov.lonebesked?.bruttoAvvikelse, -1000);
  // Nettot följer raderna vi läst, inte specens bruttolön.
  assert.equal(ov.lonebesked?.netto, 15000);
});

test("spec utan art9991 räknas lika fullt", () => {
  const ov = parse(RADER);

  assert.equal(ov.lonebesked?.bruttoBerakat, 21000);
  assert.equal(ov.lonebesked?.bruttoFranSpec, null);
  assert.equal(ov.lonebesked?.bruttoAvvikelse, undefined);
  assert.equal(ov.lonebesked?.netto, 15700);
});
