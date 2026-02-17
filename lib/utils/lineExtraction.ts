/**
 * Payslip line extraction and parsing logic
 * Handles the complex regex patterns for extracting structured data from raw text lines
 */

import { parseSwedishNumberToFloat, lastMoneyInString, extractAllMoneyValues } from './numberParsing';
import { extractDatesFromLine } from './dateExtraction';

export type PayslipLine = {
  code: string;
  name?: string;
  dateFrom?: string;
  dateTo?: string;
  qty?: number;
  unitPriceSEK?: number;
  percent?: number;
  amountSEK?: number;
  raw?: string;
};

/**
 * Attempts to parse a line with dates and multiple numeric values
 * Format: "2101 Description 2024-01-01 - 2024-01-31 123,45 456,78 789,01"
 */
function parseLineWithDates(raw: string): PayslipLine | null {
  const match = raw.match(
    /^([A-Za-z]?\d{2,6})\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})\s*(.*)$/
  );

  if (!match) {
    return null;
  }

  const code = match[1];
  const name = match[2].trim();
  const dateFrom = match[3];
  const dateTo = match[4];
  const tail = (match[5] || '').trim();

  // Extract all numeric values from the tail
  const nums = extractAllMoneyValues(tail);
  
  // Last number is typically the amount
  const amount = nums.length ? nums[nums.length - 1] : undefined;
  if (typeof amount !== 'number') {
    return null;
  }

  // First number is typically quantity
  const qty = nums.length >= 2 ? nums[0] : undefined;

  // Second-to-last number is typically unit price
  const unitPrice = nums.length >= 3 ? nums[nums.length - 2] : undefined;

  // Check for percentage value
  const percentMatch = tail.match(/(\d[\d\s]*,\d{2})\s*%/);
  const percent = percentMatch ? parseSwedishNumberToFloat(percentMatch[1]) : undefined;

  return {
    code,
    name,
    dateFrom,
    dateTo,
    qty: typeof qty === 'number' ? qty : undefined,
    unitPriceSEK: typeof unitPrice === 'number' ? unitPrice : undefined,
    percent: typeof percent === 'number' ? percent : undefined,
    amountSEK: amount,
    raw,
  };
}

/**
 * Attempts to parse a simple line with code, name, and amount
 * Format: "070 Grundlön 12 345,67"
 */
function parseSimpleLine(raw: string): PayslipLine | null {
  const match = raw.match(/^([A-Za-z]?\d{2,6})\s+(.+?)\s+([-+]?(\d[\d\s]*,\d{2}))\s*$/);
  
  if (!match) {
    return null;
  }

  const code = match[1];
  const name = match[2].trim();
  const amount = parseSwedishNumberToFloat(match[3]);
  
  if (typeof amount !== 'number') {
    return null;
  }

  return { 
    code, 
    name, 
    amountSEK: amount, 
    raw 
  };
}

/**
 * Fallback parser for lines that don't match standard formats
 * Extracts code and tries to find money value and dates
 */
function parseFallbackLine(raw: string): PayslipLine | null {
  const match = raw.match(/^([A-Za-z]?\d{2,6})\s+(.+)$/);
  
  if (!match) {
    return null;
  }

  const code = match[1];
  const rest = match[2].trim();
  const amount = lastMoneyInString(rest);
  
  if (typeof amount !== 'number') {
    return null;
  }

  // Try to extract dates
  const dates = extractDatesFromLine(rest);
  
  // Extract name by removing dates and amount
  let name = rest;
  if (dates) {
    const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch?.index !== undefined) {
      name = rest.slice(0, dateMatch.index).trim();
    }
  } else {
    // Remove the trailing money value
    name = rest.replace(/[-+]?\d[\d\s]*,\d{2}\s*$/, '').trim();
  }

  return {
    code,
    name: name || undefined,
    dateFrom: dates?.dateFrom,
    dateTo: dates?.dateTo,
    amountSEK: amount,
    raw,
  };
}

/**
 * Main function to extract all payslip lines from raw text
 * Tries multiple parsing strategies for each line
 */
export function extractPayslipLinesFromRawText(rawText: string): PayslipLine[] {
  const lines: PayslipLine[] = [];

  // Split into candidate lines
  const candidates = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const raw of candidates) {
    // Try parsing strategies in order of specificity
    const parsed = 
      parseLineWithDates(raw) ||
      parseSimpleLine(raw) ||
      parseFallbackLine(raw);

    if (parsed) {
      lines.push(parsed);
    }
  }

  return lines;
}

/**
 * Finds a line by its code
 */
export function findLineByCode(lines: PayslipLine[], code: string): PayslipLine | undefined {
  return lines.find((l) => l.code === code);
}
