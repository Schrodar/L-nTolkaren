/**
 * Slug-generering för AO-blad.
 *
 * Låg tidigare i lib/ao/storage.ts, som inleds med `import "server-only"` och
 * därför inte kan importeras från webbläsaren. Funktionerna är rena
 * strängoperationer och behövs nu på klientsidan, där AO-filerna tolkas.
 */

import type { ParsedAoSheet } from "@/lib/ao/types";

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugForSheet(sheet: ParsedAoSheet): string {
  const preferred = sheet.vesselName ?? sheet.sheetName;
  return generateSlug(preferred);
}
