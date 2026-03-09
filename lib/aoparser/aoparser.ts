import type { ParsedAoSheet, AoMode, AoWorkRow } from "@/lib/ao/types";

function toSwedishWeekday(date: Date): AoWorkRow["normalizedDay"] {
  const day = date.getDay(); // 0=sön, 1=mån ...
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

export function getAoForDate(sheet: ParsedAoSheet, mode: AoMode, isoDate: string) {
  // Find all blocks matching mode + date range, then prefer blocks with actual schedule rows.
  const candidates = sheet.blocks.filter(
    (b) =>
      b.mode === mode &&
      isoDate >= b.periodStart &&
      isoDate <= b.periodEnd
  );

  const block =
    candidates.find((b) => b.weeklySchedule.length > 0) ?? candidates[0];

  if (!block) return null;

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
    // Backwards-compat: single `row` = first match or null
    row: rows[0] ?? null,
    // All crew rows for this weekday (e.g. two crews on Monday)
    rows,
  };
}