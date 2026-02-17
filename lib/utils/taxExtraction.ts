/**
 * Tax information extraction utilities
 */

/**
 * Extracts tax table number from text
 * Example: "Skattetabell 31,00" -> "31,00"
 */
export function extractTaxTable(text: string): string | undefined {
  const match = text.match(/Skattetabell\s*(\d{1,2},\d{2})/i);
  return match?.[1];
}
