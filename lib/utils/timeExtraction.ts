/**
 * Time and hours extraction utilities
 */

import { parseSwedishNumberToFloat } from './numberParsing';

/**
 * Extracts compensation hours (Komp) from text
 */
export function extractCompensationHours(text: string): number | undefined {
  const match = text.match(/Komp\s*(\d[\d\s]*,\d{2})/i);
  if (!match) {
    return undefined;
  }
  return parseSwedishNumberToFloat(match[1]);
}

/**
 * Extracts annual work time hours (Årsarbetstid) from text
 */
export function extractAnnualWorkTimeHours(text: string): number | undefined {
  const match = text.match(/Årsarbetstid\s*(\d[\d\s]*,\d{2})/i);
  if (!match) {
    return undefined;
  }
  return parseSwedishNumberToFloat(match[1]);
}
