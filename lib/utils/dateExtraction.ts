/**
 * Date extraction utilities for payslip parsing
 */

/**
 * Extracts a date range from text
 * Format: "2024-01-01 - 2024-01-31"
 * Returns {from, to} or undefined if not found
 */
export function pickDateRange(text: string): { from: string; to: string } | undefined {
  const m = text.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    return undefined;
  }
  return { from: m[1], to: m[2] };
}

/**
 * Extracts a single date that appears after a specific label
 * Example: "Utbetalningsdag 2024-01-31" -> "2024-01-31"
 */
export function pickSingleDateAfterLabel(text: string, label: string): string | undefined {
  const re = new RegExp(`${label}\\s*(\\d{4}-\\d{2}-\\d{2})`, 'i');
  const m = text.match(re);
  return m?.[1];
}

/**
 * Extracts dates from a raw line string
 * Returns {dateFrom, dateTo} or undefined
 */
export function extractDatesFromLine(raw: string): { dateFrom: string; dateTo: string } | undefined {
  const m = raw.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    return undefined;
  }
  return { dateFrom: m[1], dateTo: m[2] };
}
