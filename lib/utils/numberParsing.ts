/**
 * Number and money parsing utilities for Swedish formats
 */

/**
 * Parses a Swedish-formatted number string to a float
 * Handles formats like "1 234,56" or "1.234,56" -> 1234.56
 * Returns undefined if the string is not a valid number
 */
export function parseSwedishNumberToFloat(raw: string): number | undefined {
  // Remove all spaces, replace dots (thousand separators) with nothing,
  // and replace comma (decimal separator) with dot
  const s = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  
  // Validate it's a proper number
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) {
    return undefined;
  }
  
  return Number(s);
}

/**
 * Finds and parses the last money value in a string
 * Money format: "123,45" or "-123,45"
 */
export function lastMoneyInString(raw: string): number | undefined {
  const nums = raw.match(/[-+]?\d[\d\s]*,\d{2}/g);
  if (!nums || !nums.length) {
    return undefined;
  }
  return parseSwedishNumberToFloat(nums[nums.length - 1]);
}

/**
 * Extracts all money values from a string and returns them as an array
 * Money format: "123,45" or "-123,45"
 */
export function extractAllMoneyValues(text: string): number[] {
  const nums = text.match(/[-+]?\d[\d\s]*,\d{2}/g) || [];
  return nums
    .map(parseSwedishNumberToFloat)
    .filter((n): n is number => typeof n === 'number');
}
