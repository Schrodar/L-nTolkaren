/**
 * Svenska helgdags- och OB-regler för sjöfartsavtalet.
 *
 * Alla datum beräknas dynamiskt per år. Cache hålls i minnet per körning.
 *
 * Hierarki:
 *   storhelg  → effectiveDayType 'söndag'  (kvalificerad OB hela dagen)
 *   småhelg   → effectiveDayType 'lördag'  (OB hela dagen)
 *   dag-före  → effectiveDayType 'fredag'  (Fredag-OB, sätts om dagen inte redan är helg/helgafton)
 *   fredag    → effectiveDayType 'fredag'  (fysisk fredag, hanteras i getEffectiveAoDayType)
 *   lördag    → effectiveDayType 'lördag'  (fysisk lördag)
 *   söndag    → effectiveDayType 'söndag'  (fysisk söndag)
 *   övriga    → effectiveDayType 'vardag'
 */

export type HolidayType = 'storhelg' | 'småhelg' | null;

/** Effektiv dagtyp för OB-beräkning enligt avtal. */
export type EffectiveAoDayType = 'vardag' | 'fredag' | 'lördag' | 'söndag';

export type HolidayInfo = {
  holidayType: HolidayType;
  /** Visningsnamn, t.ex. "Julafton", "Dag före storhelg". */
  label: string;
  effectiveDayType: EffectiveAoDayType;
};

// ── Hjälpfunktioner ─────────────────────────────────────────────────────────

/**
 * Beräknar påskdagen (Easter Sunday) för ett givet år.
 * Algoritm: Meeus/Jones/Butcher.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Returnerar "YYYY-MM-DD" baserat på lokal tid. */
function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lägger till `days` dagar på ett datum (lokal tid). */
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

// ── Bygger kalendariet för ett år ───────────────────────────────────────────

/**
 * Beräknar alla helgdagar och "dag-före-storhelg" för ett kalenderår.
 * Returnerar en Map från ISO-datumsträng till HolidayInfo.
 */
function buildHolidayMap(year: number): Map<string, HolidayInfo> {
  const map = new Map<string, HolidayInfo>();

  function set(d: Date, type: HolidayType, label: string, effectiveDayType: EffectiveAoDayType) {
    map.set(dateToISO(d), { holidayType: type, label, effectiveDayType });
  }

  const easter = getEasterSunday(year);

  // ── Storhelger ──────────────────────────────────────────────────────────
  // behandlas som söndag i OB-hänseende
  set(new Date(year, 0, 1),   'storhelg', 'Nyårsdagen',       'söndag');
  set(addDays(easter, -2),    'storhelg', 'Långfredag',        'söndag');
  set(addDays(easter, -1),    'storhelg', 'Påskafton',         'söndag');
  set(easter,                 'storhelg', 'Påskdagen',         'söndag');
  set(addDays(easter, 1),     'storhelg', 'Annandag påsk',     'söndag');
  set(addDays(easter, 49),    'storhelg', 'Pingstdagen',       'söndag');
  set(new Date(year, 11, 24), 'storhelg', 'Julafton',          'söndag');
  set(new Date(year, 11, 25), 'storhelg', 'Juldagen',          'söndag');
  set(new Date(year, 11, 26), 'storhelg', 'Annandag jul',      'söndag');
  set(new Date(year, 11, 31), 'storhelg', 'Nyårsafton',        'söndag');

  // Midsommardagen = första lördagen ≥ 20 juni
  const june20 = new Date(year, 5, 20);
  const daysToSat = (6 - june20.getDay() + 7) % 7;
  const midsommardagen = addDays(june20, daysToSat);
  const midsommarafton = addDays(midsommardagen, -1); // alltid en fredag
  set(midsommarafton, 'storhelg', 'Midsommarafton', 'söndag'); // OB-mässigt = söndag
  set(midsommardagen, 'storhelg', 'Midsommardagen', 'söndag');

  // ── Småhelger ───────────────────────────────────────────────────────────
  // behandlas som lördag i OB-hänseende
  set(new Date(year, 0, 6),          'småhelg', 'Trettondagen',           'lördag');
  set(new Date(year, 4, 1),          'småhelg', '1 maj',                  'lördag');
  set(addDays(easter, 39),           'småhelg', 'Kristi himmelsfärdsdag', 'lördag');
  set(new Date(year, 5, 6),          'småhelg', 'Sveriges nationaldag',   'lördag');

  // Alla helgons dag = första lördagen i november (lördag ≥ 1 nov)
  const nov1 = new Date(year, 10, 1);
  const daysToNovSat = (6 - nov1.getDay() + 7) % 7;
  const allaHelgon = addDays(nov1, daysToNovSat);
  set(allaHelgon, 'småhelg', 'Alla helgons dag', 'lördag');

  // ── Dag före varje storhelg → fredag-OB ────────────────────────────────
  // Samla storhelgsdatum (snapshot innan vi muterar map)
  const storhelgDates = [...map.entries()]
    .filter(([, info]) => info.holidayType === 'storhelg')
    .map(([iso]) => iso);

  for (const iso of storhelgDates) {
    const d = new Date(`${iso}T00:00:00`);
    const dayBefore = addDays(d, -1);
    const dayBeforeISO = dateToISO(dayBefore);

    // Bara inom samma år, inte redan markerat, och inte fysisk lör/sön
    if (
      dayBeforeISO.startsWith(`${year}-`) &&
      !map.has(dayBeforeISO)
    ) {
      const dow = dayBefore.getDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) {
        map.set(dayBeforeISO, {
          holidayType: null,
          label: 'Dag före storhelg',
          effectiveDayType: 'fredag',
        });
      }
    }
  }

  return map;
}

// ── Cache ────────────────────────────────────────────────────────────────────

const _cache = new Map<number, Map<string, HolidayInfo>>();

function getMapForYear(year: number): Map<string, HolidayInfo> {
  if (!_cache.has(year)) {
    _cache.set(year, buildHolidayMap(year));
  }
  return _cache.get(year)!;
}

// ── Publika funktioner ───────────────────────────────────────────────────────

/**
 * Slår upp helgdagsinfo för ett ISO-datum.
 * Returnerar null om datumet är en vanlig vardag/lördag/söndag utan specialregler.
 *
 * @param isoDate - Datum i formatet "YYYY-MM-DD"
 */
export function getHolidayInfo(isoDate: string): HolidayInfo | null {
  const year = parseInt(isoDate.slice(0, 4), 10);
  if (isNaN(year)) return null;
  return getMapForYear(year).get(isoDate) ?? null;
}

/**
 * Returnerar alla HolidayInfo-poster för en given månad.
 *
 * @param year  - Kalenderår, t.ex. 2026
 * @param month - Månad 1–12
 */
export function getHolidayInfoForMonth(year: number, month: number): Map<string, HolidayInfo> {
  const result = new Map<string, HolidayInfo>();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  for (const [iso, info] of getMapForYear(year)) {
    if (iso.startsWith(prefix)) {
      result.set(iso, info);
    }
  }
  return result;
}

/**
 * Returnerar den effektiva AO-dagtypen för ett datum inklusive helgdagsregler.
 *
 * Prioritetsordning:
 *   1. Fysisk söndag → 'söndag' (kan ej sänkas)
 *   2. Fysisk lördag → 'lördag' (kan ej sänkas)
 *   3. Storhelg/småhelg/dag-före → från HolidayInfo.effectiveDayType
 *   4. Fysisk fredag → 'fredag'
 *   5. Övriga vardagar → 'vardag'
 */
export function getEffectiveAoDayType(isoDate: string): EffectiveAoDayType {
  const dow = new Date(`${isoDate}T00:00:00`).getDay(); // 0=Sun, 6=Sat
  if (dow === 0) return 'söndag';
  if (dow === 6) return 'lördag';
  const info = getHolidayInfo(isoDate);
  if (info) return info.effectiveDayType;
  if (dow === 5) return 'fredag';
  return 'vardag';
}
