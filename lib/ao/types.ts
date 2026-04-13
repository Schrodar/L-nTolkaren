/**
 * Typer för AO-schemat (Arbetsordning) i Lönetolkaren.
 *
 * AO-data sparas som JSON lokalt på servern (storage/ao/).
 * Varje sparad fil representerar ett blad från en AO-Excel-arbetsbok.
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
  normalizedDay: WeekdayKey | undefined;
  dayLabel: string;
  workStart: string | null;
  workEnd: string | null;
  aoBruttotid: string | null;
  aoRastStart: string | null;
  aoRastEnd: string | null;
  annanRast1Start: string | null;
  annanRast1End: string | null;
  annanRast2Start: string | null;
  annanRast2End: string | null;
  annanRastMatStart: string | null;
  annanRastMatEnd: string | null;
  rawCells: (string | number | null)[];
};

/**
 * En undantagsrad (datumspecifikt undantag) i ett AO-block.
 */
export type AoExceptionRow = {
  label: string;
  resolvedDate: string | null;
  workStart: string | null;
  workEnd: string | null;
  aoBruttotid: string | null;
  aoRastStart: string | null;
  aoRastEnd: string | null;
  annanRast1Start: string | null;
  annanRast1End: string | null;
  annanRast2Start: string | null;
  annanRast2End: string | null;
  annanRastMatStart: string | null;
  annanRastMatEnd: string | null;
  rawCells: (string | number | null)[];
};

// ── Block ───────────────────────────────────────────────────────────────────

/**
 * Ett datumintervall { from, to } i ISO-format.
 * Används för block som gäller flera icke-sammanhängande perioder,
 * t.ex. "2026-04-02 t.o.m. 2026-05-07 samt 2026-09-14 t.o.m. 2026-12-11".
 */
export type AoPeriod = {
  from: string;
  to: string;
};

/**
 * Ett AO-block representerar en period med ett specifikt isläge.
 */
export type AoBlock = {
  /** Hela rubriken från Excel. */
  heading: string;
  /** Primär periodens start i ISO-format (första intervallet). */
  periodStart: string;
  /** Primär periodens slut i ISO-format (första intervallet). */
  periodEnd: string;
  /**
   * Alla perioder som blocket gäller — normalt ett intervall,
   * men vår/höst-AO kan ha två: vår + höst i samma block.
   */
  extraPeriods: AoPeriod[];
  /** Islägets typ: "is" eller "isfri". */
  mode: AoMode;
  /**
   * Sant om blocket explicit nämner isläge i rubriken.
   * Falskt = inget isläge i filen (t.ex. sommarsäsong) → UI ska inte visa islägesväljare.
   */
  modeExplicit: boolean;
  /** Besättningsindex (0-baserat) för båtar med flera crew-block per period. */
  crewIndex: number;
  /** Ordinarie veckoschema (mån–sön). */
  weeklySchedule: AoWorkRow[];
  /** Datumspecifika undantag från veckoschemat. */
  exceptions: AoExceptionRow[];
  /** Lösa anteckningar kopplade till blocket. */
  notes: string[];
};

// ── Parsad sheet ────────────────────────────────────────────────────────────

export type ParsedAoSheet = {
  sheetName: string;
  vesselName: string | null;
  vesselPrefix: string | null;
  registration: string | null;
  /** Första giltighetsdatum (kan vara vår-start för vår/höst-filer). */
  validFrom: string | null;
  /** Sista giltighetsdatum (kan vara höst-slut för vår/höst-filer). */
  validTo: string | null;
  /**
   * Alla giltighetsperioder — vinter-AO har en, vår/höst-AO har två.
   * Används av getAoForDate() för att avgöra om filen täcker ett visst datum.
   */
  validPeriods: AoPeriod[];
  /**
   * Sant om filen innehåller minst ett block med explicit is/isfri-markering.
   * Falskt för sommarsäsong → UI döljer islägesväljaren.
   */
  hasIsVariant: boolean;
  roles: string | null;
  costCenter: string | null;
  blocks: AoBlock[];
  parseErrors: string[];
};

// ── Lagringsmetadata ────────────────────────────────────────────────────────

export type StoredAoSheetMeta = {
  slug: string;
  sheetName: string;
  vesselName: string | null;
  validFrom: string | null;
  validTo: string | null;
  blockCount: number;
  modes: AoMode[];
  exceptionCount: number;
  savedAt: string;
  /** Kopierat från ParsedAoSheet för snabb tillgång i listningsvyn. */
  hasIsVariant: boolean;
  validPeriods: AoPeriod[];
};
