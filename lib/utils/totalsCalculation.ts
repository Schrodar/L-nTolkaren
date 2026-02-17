/**
 * Payslip totals calculation and derivation utilities
 */

import type { PayslipLine } from './lineExtraction';
import { findLineByCode } from './lineExtraction';

export type MoneySEK = number;

/**
 * Derives base salary from payslip lines (code 070)
 */
export function deriveBaseSalary(lines: PayslipLine[]): MoneySEK | undefined {
  return findLineByCode(lines, '070')?.amountSEK;
}

/**
 * Derives union fee from payslip lines (code 960)
 */
export function deriveUnionFee(lines: PayslipLine[]): MoneySEK | undefined {
  return findLineByCode(lines, '960')?.amountSEK;
}

/**
 * Derives gross amount from code 9991
 */
export function deriveGrossFrom9991(lines: PayslipLine[]): MoneySEK | undefined {
  return findLineByCode(lines, '9991')?.amountSEK;
}

/**
 * Extracts all derived values from payslip lines
 */
export function extractDerivedValues(lines: PayslipLine[]) {
  return {
    baseSalarySEK: deriveBaseSalary(lines),
    unionFeeSEK: deriveUnionFee(lines),
    grossFrom9991SEK: deriveGrossFrom9991(lines),
  };
}
