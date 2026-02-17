// parseBlidosundsPayslip.ts
// Refactored to use utility modules for better readability and maintainability

// Import utility functions organized by domain
import { normalizeText } from '@/lib/utils/textNormalization';
import { pickDateRange, pickSingleDateAfterLabel } from '@/lib/utils/dateExtraction';
import { 
  pickMoneyAfterLabel, 
  pickIntAfterLabel, 
  pickStringAfterLabel 
} from '@/lib/utils/fieldExtraction';
import { 
  extractPayslipLinesFromRawText, 
  type PayslipLine 
} from '@/lib/utils/lineExtraction';
import { 
  buildArtCountsFromArtGroups,
  type ArtGroup,
  type ArtCountRow
} from '@/lib/utils/artGroupProcessing';
import { extractDerivedValues } from '@/lib/utils/totalsCalculation';
import { 
  extractCompensationHours, 
  extractAnnualWorkTimeHours 
} from '@/lib/utils/timeExtraction';
import { extractTaxTable } from '@/lib/utils/taxExtraction';

// Type definitions (kept in main file as they define the public API)
export type MoneySEK = number;

// Re-export types for backward compatibility
export type { PayslipLine, ArtGroup, ArtCountRow };

export type PayslipAnalysis = {
  employer?: string;
  employeeName?: string;

  period?: { from: string; to: string };
  payoutDate?: string;

  costCenter?: string;
  employmentRatePercent?: number;

  taxTable?: string;
  preliminaryTaxPeriodSEK?: MoneySEK;

  grossPeriodSEK?: MoneySEK;
  netPaySEK?: MoneySEK;

  compHours?: number;
  annualWorkTimeHours?: number;

  // gamla rader (kan användas senare för belopp/datum)
  lines: PayslipLine[];

  // ✅ nya grejer från lilla parsen
  artGroups?: ArtGroup[];
  artCounts?: ArtCountRow[];

  baseSalarySEK?: MoneySEK;
  unionFeeSEK?: MoneySEK;
  grossFrom9991SEK?: MoneySEK;
  notes: string[];
};

/**
 * Main payslip parser - orchestrates all parsing steps
 * Now using modular utility functions for better readability
 */
export function parseBlidosundsPayslip(rawText: string, artGroups?: ArtGroup[]): PayslipAnalysis {
  const text = normalizeText(rawText);
  const notes: string[] = [];

  // Initialize analysis object with defaults
  const analysis: PayslipAnalysis = {
    employer: 'Blidösundsbolaget AB',
    lines: [],
    notes,
  };

  // Extract period dates
  const period = pickDateRange(text);
  if (period) {
    analysis.period = period;
  } else {
    notes.push('Kunde inte hitta period (YYYY-MM-DD - YYYY-MM-DD) i texten.');
  }

  // Extract payout date and net pay
  analysis.payoutDate = pickSingleDateAfterLabel(text, 'Utbetalningsdag');
  analysis.netPaySEK = pickMoneyAfterLabel(text, 'Att utbetala');
  if (!analysis.netPaySEK) {
    notes.push("Kunde inte hitta 'Att utbetala'.");
  }

  // Extract tax information
  analysis.taxTable = extractTaxTable(text);
  analysis.preliminaryTaxPeriodSEK = pickMoneyAfterLabel(text, 'Preliminär skatt');

  // Extract employment information
  analysis.costCenter = pickStringAfterLabel(text, 'Kostnadsställe');
  analysis.employmentRatePercent = pickIntAfterLabel(text, 'Sysselsättningsgrad');
  analysis.grossPeriodSEK = pickMoneyAfterLabel(text, 'Bruttolön perioden');

  // Extract time/hours information
  analysis.compHours = extractCompensationHours(text);
  analysis.annualWorkTimeHours = extractAnnualWorkTimeHours(text);

  // Parse individual payslip lines
  analysis.lines = extractPayslipLinesFromRawText(rawText);

  // Process art groups if available
  if (artGroups?.length) {
    analysis.artGroups = artGroups;
    analysis.artCounts = buildArtCountsFromArtGroups(artGroups);
  } else {
    notes.push('artGroups saknas (pdfjs). Art-tabellen kan bli ofullständig tills pdfjs-parsen kopplas in.');
    analysis.artCounts = [];
  }

  // Calculate derived values (base salary, union fee, etc.)
  const derived = extractDerivedValues(analysis.lines);
  analysis.baseSalarySEK = derived.baseSalarySEK;
  analysis.grossFrom9991SEK = derived.grossFrom9991SEK;
  analysis.unionFeeSEK = derived.unionFeeSEK;

  return analysis;
}
