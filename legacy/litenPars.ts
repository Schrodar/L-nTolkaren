// super-enkel parser: räkna löneart 2101 i rå PDF-text
export function count2101(rawText: string): number {
  if (!rawText) return 0;

  // matcha 2101 som egen kod (inte 21010, 12101 osv)
  const matches = rawText.match(/(^|\D)2101(\D|$)/g);
  return matches ? matches.length : 0;
}
