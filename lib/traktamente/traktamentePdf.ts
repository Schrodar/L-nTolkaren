/**
 * Genererar PDF-listan över obetalt traktamente för ett kalenderår.
 *
 * jsPDF importeras dynamiskt av anroparen så att biblioteket inte belastar
 * sidans bundle förrän användaren faktiskt laddar ner listan. Allt sker i
 * webbläsaren — ingen data lämnar datorn.
 */

import type { jsPDF } from "jspdf";
import type { TraktamenteRow } from "@/lib/traktamente/buildTraktamenteRows";

type Column = { header: string; x: number; get: (r: TraktamenteRow) => string };

const MARGIN_X = 14;
const PAGE_BOTTOM = 280;
const LINE_H = 6;

function formatEnd(row: TraktamenteRow): string {
  if (!row.end) return "–";
  const suffix = `${row.endAdjusted ? " *" : ""}${row.endNextDay ? " (+1)" : ""}`;
  return `${row.end}${suffix}`;
}

const COLUMNS: Column[] = [
  { header: "Datum", x: MARGIN_X, get: (r) => r.dateISO },
  { header: "Dag", x: MARGIN_X + 26, get: (r) => r.weekday },
  { header: "Start", x: MARGIN_X + 40, get: (r) => r.start ?? "–" },
  { header: "Slut", x: MARGIN_X + 58, get: (r) => formatEnd(r) },
  { header: "Båt", x: MARGIN_X + 84, get: (r) => r.boat || "–" },
  { header: "Natthamn", x: MARGIN_X + 130, get: (r) => r.natthamn || "–" },
];

function drawHeader(doc: jsPDF, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  for (const col of COLUMNS) doc.text(col.header, col.x, y);
  doc.setDrawColor(150);
  doc.line(MARGIN_X, y + 1.5, 196, y + 1.5);
  doc.setFont("helvetica", "normal");
  return y + LINE_H;
}

export function renderTraktamentePdf(
  doc: jsPDF,
  year: number,
  rows: TraktamenteRow[],
  employeeName?: string | null
): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Obetalt traktamente ${year}`, MARGIN_X, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Övernattning ombord", MARGIN_X, 27);
  if (employeeName) doc.text(employeeName, MARGIN_X, 33);

  let y = employeeName ? 43 : 37;
  y = drawHeader(doc, y);

  doc.setFontSize(9);
  for (const row of rows) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = drawHeader(doc, 20);
      doc.setFontSize(9);
    }
    for (const col of COLUMNS) {
      doc.text(col.get(row), col.x, y);
    }
    y += LINE_H;
  }

  // Summering sist
  y += 3;
  if (y > PAGE_BOTTOM) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(150);
  doc.line(MARGIN_X, y - 3, 196, y - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    `Totalt ${rows.length} ${rows.length === 1 ? "dag" : "dagar"} markerade för obetalt traktamente.`,
    MARGIN_X,
    y + 2
  );

  if (rows.some((r) => r.endAdjusted)) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "* Sluttid uppskriven med mellanskillnaden mot lönespecens arbetade timmar.",
      MARGIN_X,
      y + 9
    );
  }
}

/** Skapar dokumentet och startar nedladdningen. */
export async function downloadTraktamentePdf(
  year: number,
  rows: TraktamenteRow[],
  employeeName?: string | null
): Promise<void> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf();
  renderTraktamentePdf(doc, year, rows, employeeName);
  doc.save(`obetalt-traktamente-${year}.pdf`);
}
