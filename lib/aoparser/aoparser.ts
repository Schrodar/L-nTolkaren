import type { ParsedAoSheet, AoMode, AoWorkRow, AoBlock } from "@/lib/ao/types";

function toSwedishWeekday(date: Date): AoWorkRow["normalizedDay"] {
  const day = date.getDay();
  switch (day) {
    case 1: return "mon";
    case 2: return "tue";
    case 3: return "wed";
    case 4: return "thu";
    case 5: return "fri";
    case 6: return "sat";
    case 0: return "sun";
    default: return undefined;
  }
}

/**
 * Kontrollerar om ett ISO-datum faller inom ett blocks perioder.
 * Kollar primärperioden (periodStart/periodEnd) samt alla extraPeriods.
 */
function blockCoversDate(block: AoBlock, isoDate: string): boolean {
  // Primärperiod
  if (isoDate >= block.periodStart && isoDate <= block.periodEnd) return true;

  // Extra perioder (t.ex. höst-perioden i en vår/höst-AO)
  for (const extra of block.extraPeriods ?? []) {
    if (isoDate >= extra.from && isoDate <= extra.to) return true;
  }

  return false;
}

export function getAoForDate(sheet: ParsedAoSheet, mode: AoMode, isoDate: string) {
  // Hitta alla block som matchar isläge och täcker datumet
  const candidates = sheet.blocks.filter(
    (b) => b.mode === mode && blockCoversDate(b, isoDate)
  );

  // Föredra block med faktiska schemat-rader
  const block =
    candidates.find((b) => b.weeklySchedule.length > 0) ?? candidates[0];

  if (!block) return null;

  // Kolla undantag
  const exception = block.exceptions.find((e) => e.resolvedDate === isoDate);
  if (exception) {
    return {
      source: "exception" as const,
      block,
      row: exception,
    };
  }

  const weekday = toSwedishWeekday(new Date(`${isoDate}T12:00:00`));
  const rows = block.weeklySchedule.filter((r) => r.normalizedDay === weekday);

  return {
    source: "regular" as const,
    block,
    row: rows[0] ?? null,
    rows,
  };
}
