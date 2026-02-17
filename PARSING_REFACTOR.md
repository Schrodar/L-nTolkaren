# Parsing Logic Refactoring

## Overview
The payslip parsing logic has been refactored into smaller, focused utility modules for better readability and maintainability.

## New Structure

### Utility Modules (lib/utils/)

All parsing helper functions have been extracted into domain-specific modules:

#### 1. **textNormalization.ts**
- `normalizeText()` - Normalizes whitespace and removes special characters
- `descriptionFromRawRow()` - Extracts clean descriptions from raw art rows

#### 2. **numberParsing.ts**
- `parseSwedishNumberToFloat()` - Parses Swedish number format (e.g., "1 234,56")
- `lastMoneyInString()` - Finds the last money value in a string
- `extractAllMoneyValues()` - Extracts all money values from text

#### 3. **dateExtraction.ts**
- `pickDateRange()` - Extracts date ranges (YYYY-MM-DD - YYYY-MM-DD)
- `pickSingleDateAfterLabel()` - Finds dates after specific labels
- `extractDatesFromLine()` - Extracts dates from line strings

#### 4. **fieldExtraction.ts**
- `pickMoneyAfterLabel()` - Extracts money amounts after labels
- `pickIntAfterLabel()` - Extracts integer values after labels
- `pickStringAfterLabel()` - Extracts string values after labels

#### 5. **lineExtraction.ts**
- `extractPayslipLinesFromRawText()` - Main line parsing logic
- `parseLineWithDates()` - Handles lines with date ranges
- `parseSimpleLine()` - Handles simple code + name + amount lines
- `parseFallbackLine()` - Fallback parser for non-standard formats
- `findLineByCode()` - Helper to find lines by code

#### 6. **artGroupProcessing.ts**
- `buildArtCountsFromArtGroups()` - Creates art count summaries

#### 7. **totalsCalculation.ts**
- `deriveBaseSalary()` - Extracts base salary (code 070)
- `deriveUnionFee()` - Extracts union fee (code 960)
- `deriveGrossFrom9991()` - Extracts gross from code 9991
- `extractDerivedValues()` - Calculates all derived values

#### 8. **timeExtraction.ts**
- `extractCompensationHours()` - Extracts Komp hours
- `extractAnnualWorkTimeHours()` - Extracts Årsarbetstid hours

#### 9. **taxExtraction.ts**
- `extractTaxTable()` - Extracts tax table number

## Main Parser

**legacy/parseBlidosundsPayslip.ts** now orchestrates all the smaller functions:
- Clearer flow and structure
- Each step is self-documenting with descriptive comments
- All types exported for backward compatibility
- No breaking changes to public API

## Benefits

1. **Readability**: Each function has a single, clear purpose
2. **Maintainability**: Easy to locate and update specific parsing logic
3. **Testability**: Small functions are easier to unit test
4. **Reusability**: Utility functions can be imported individually
5. **Documentation**: Function names are self-explanatory

## Usage

The public API remains unchanged. Continue using:

```typescript
import { parseBlidosundsPayslip, type PayslipAnalysis } from '@/legacy/parseBlidosundsPayslip';

const analysis = parseBlidosundsPayslip(rawText, artGroups);
```

## No Breaking Changes

- All existing type definitions remain in the main file
- Types are re-exported for backward compatibility
- Variable names and data structures unchanged
- UI components continue to work without modification
