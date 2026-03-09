/**
 * Typer för AO-schemat (Arbetsordning) i Lönetolkaren.
 *
 * AO-data sparas som JSON lokalt på servern (storage/ao/).
 * Varje sparad fil representerar ett blad från en AO-Excel-arbetsbok.
 *
 * Framtida användning: när användaren väljer båt + isläge + datum kan
 * getAoForDate() (lib/aoparser/aoparser.ts) slå upp rätt block och rad.
 */

// ── Grundläggande typer ─────────────────────────────────────────────────────

/** Isläge för ett AO-block: "is" = vinterperiod med is, "isfri" = isfrittvatten. */
export type AoMode = "is" | "isfri";

/** Normaliserat engelska veckodagsnamn för intern sökning. */
export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

// ── Rader i AO-schemat ──────────────────────────────────────────────────────

/**
 * En ordinarie veckodag i ett AO-block.
 * normalizedDay används för att slå upp datumet mot rätt rad.
 */
export type AoWorkRow = {
  /** Normaliserat engelskt veckodagsnamn ("mon"–"sun"), null om okänt. */
  normalizedDay: WeekdayKey | undefined;
  /** Originaletiketten från Excel, t.ex. "mån", "fre>", "<lör". */
  dayLabel: string;
  /** Arbetstidens start, t.ex. "08:45". */
  workStart: string | null;
  /** Arbetstidens slut, t.ex. "20:30". */
  workEnd: string | null;
  /** AO Bruttotid A, t.ex. "11:45". */
  aoBruttotid: string | null;
  /** AO-rastens start (Rast B). */
  aoRastStart: string | null;
  /** AO-rastens slut (Rast B). */
  aoRastEnd: string | null;
  /** Annan rast 1, start. */
  annanRast1Start: string | null;
  /** Annan rast 1, slut. */
  annanRast1End: string | null;
  /** Annan rast 2, start. */
  annanRast2Start: string | null;
  /** Annan rast 2, slut. */
  annanRast2End: string | null;
  /** Annan rast mat (matrast), start. */
  annanRastMatStart: string | null;
  /** Annan rast mat (matrast), slut. */
  annanRastMatEnd: string | null;
  /** Rådata från Excel-raden för felsökning. */
  rawCells: (string | number | null)[];
};

/**
 * En undantagsrad (datumspecifikt undantag) i ett AO-block.
 * Dessa gäller för specifika datum och ersätter veckodagsraden.
 */
export type AoExceptionRow = {
  /** Originaletiketten från Excel, t.ex. "15.12", "22.12 Julafton". */
  label: string;
  /** Löst ISO-datum, t.ex. "2025-12-15". Null om det inte gick att tolka. */
  resolvedDate: string | null;
  /** Arbetstidens start. */
  workStart: string | null;
  /** Arbetstidens slut. */
  workEnd: string | null;
  /** AO Bruttotid. */
  aoBruttotid: string | null;
  /** AO-rastens start. */
  aoRastStart: string | null;
  /** AO-rastens slut. */
  aoRastEnd: string | null;
  /** Annan rast 1, start. */
  annanRast1Start: string | null;
  /** Annan rast 1, slut. */
  annanRast1End: string | null;
  /** Annan rast 2, start. */
  annanRast2Start: string | null;
  /** Annan rast 2, slut. */
  annanRast2End: string | null;
  /** Annan rast mat (matrast), start. */
  annanRastMatStart: string | null;
  /** Annan rast mat (matrast), slut. */
  annanRastMatEnd: string | null;
  /** Rådata från Excel-raden för felsökning. */
  rawCells: (string | number | null)[];
};

// ── Block ───────────────────────────────────────────────────────────────────

/**
 * Ett AO-block representerar en period med ett specifikt isläge.
 * Blocket innehåller en ordinarie veckoplanering och specifika undantag.
 */
export type AoBlock = {
  /** Hela rubriken från Excel, t.ex. "2025-12-16 t.o.m. 2026-01-06 (Isfri period...)". */
  heading: string;
  /** Periodens start i ISO-format, t.ex. "2025-12-16". */
  periodStart: string;
  /** Periodens slut i ISO-format, t.ex. "2026-01-06". */
  periodEnd: string;
  /** Islägets typ: "is" eller "isfri". */
  mode: AoMode;
  /** Ordinarie veckoschema (mån–sön). */
  weeklySchedule: AoWorkRow[];
  /** Datumspecifika undantag från veckoschemat. */
  exceptions: AoExceptionRow[];
  /** Lösa anteckningar kopplade till blocket. */
  notes: string[];
};

// ── Parsad sheet ────────────────────────────────────────────────────────────

/**
 * Resultat av att parsea ett blad i en AO-Excel-arbetsbok.
 * En arbetsbok kan innehålla flera blad (en per båt/roll).
 * Varje parsad sheet sparas som en separat JSON-fil i storage/ao/.
 */
export type ParsedAoSheet = {
  /** Bladets namn i Excel, t.ex. "Nämdö" eller "Matros". */
  sheetName: string;
  /** Fartygets namn, t.ex. "Nämdö". */
  vesselName: string | null;
  /** Fartygets prefix, t.ex. "M/S". */
  vesselPrefix: string | null;
  /** Registreringssignal, t.ex. "SMRN". */
  registration: string | null;
  /** Giltighetsperiodens start i ISO-format. */
  validFrom: string | null;
  /** Giltighetsperiodens slut i ISO-format. */
  validTo: string | null;
  /** Befattning/roll, t.ex. "Matros, lättmatros, jungman". */
  roles: string | null;
  /** Kostnadsställe. */
  costCenter: string | null;
  /** Alla tolkade AO-block (är/isfri-perioder). */
  blocks: AoBlock[];
  /** Tolkningsfel och varningar som uppstod under parsningen. */
  parseErrors: string[];
};

// ── Lagringsmetadata ────────────────────────────────────────────────────────

/**
 * Metadata om en sparad AO-JSON-fil, används i listningsvy.
 */
export type StoredAoSheetMeta = {
  /** Slug/filnamn utan .json-ändelse, t.ex. "ms-namdo". */
  slug: string;
  /** Bladets namn. */
  sheetName: string;
  /** Fartygets namn. */
  vesselName: string | null;
  /** Giltighetsperiod start. */
  validFrom: string | null;
  /** Giltighetsperiod slut. */
  validTo: string | null;
  /** Antal blocks. */
  blockCount: number;
  /** Vilka islägen som finns (deduplicerat). */
  modes: AoMode[];
  /** Totalt antal undantag. */
  exceptionCount: number;
  /** Tidpunkt (ISO) när filen senast sparades. */
  savedAt: string;
};
