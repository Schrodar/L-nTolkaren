/**
 * Generic field extraction utilities for parsing payslip text
 */

import { parseSwedishNumberToFloat } from './numberParsing';

/**
 * Extracts a money amount that appears after a specific label
 * Example: "Bruttolön 12 345,67" -> 12345.67
 */
export function pickMoneyAfterLabel(text: string, label: string): number | undefined {
  const re = new RegExp(`${label}\\s*([-+]?\\d[\\d\\s]*,\\d{2})`, 'i');
  const m = text.match(re);
  if (!m) {
    return undefined;
  }
  return parseSwedishNumberToFloat(m[1]);
}

/**
 * Extracts an integer value that appears after a specific label
 * Rounds the parsed number to nearest integer
 */
export function pickIntAfterLabel(text: string, label: string): number | undefined {
  const re = new RegExp(`${label}\\s*(\\d[\\d\\s]*,\\d{2})`, 'i');
  const m = text.match(re);
  if (!m) {
    return undefined;
  }
  const n = parseSwedishNumberToFloat(m[1]);
  return typeof n === 'number' ? Math.round(n) : undefined;
}

/**
 * Extracts a string value that appears after a specific label
 * Example: "Kostnadsställe ABC123" -> "ABC123"
 */
export function pickStringAfterLabel(text: string, label: string): string | undefined {
  const re = new RegExp(`${label}\\s*([A-Za-z0-9\\-]+)`, 'i');
  const m = text.match(re);
  return m?.[1];
}
