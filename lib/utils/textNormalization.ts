/**
 * Text normalization utilities for payslip parsing
 */

/**
 * Normalizes text by:
 * - Converting non-breaking spaces to regular spaces
 * - Collapsing multiple spaces/tabs into single spaces
 * - Removing carriage returns
 * - Trimming leading/trailing whitespace
 */
export function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

/**
 * Extracts a clean description from a raw art row
 * Example: "2101 Maskinskötseltillägg 2025-..." -> "Maskinskötseltillägg"
 */
export function descriptionFromRawRow(art: string, raw: string): string {
  let s = raw.trim();
  
  // Remove art code prefix
  if (s.startsWith(art + ' ')) {
    s = s.slice(art.length).trim();
  }

  // Remove date portion (anything after first date)
  const dateIdx = s.search(/\d{4}-\d{2}-\d{2}/);
  if (dateIdx >= 0) {
    s = s.slice(0, dateIdx).trim();
  }

  // Normalize spacing
  s = s.replace(/\s+/g, ' ').trim();

  return s || 'Okänd';
}
