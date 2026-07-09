import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

const file = process.argv[2];
const data = new Uint8Array(fs.readFileSync(file));
const doc = await getDocument({ data, useSystemFonts: true }).promise;

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const rows = new Map();
  for (const item of content.items) {
    const y = Math.round(item.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: item.transform[4], str: item.str });
  }
  const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]);
  console.log(`=== Sida ${p} ===`);
  for (const [, items] of sorted) {
    const line = items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" | ");
    if (line.trim()) console.log(line);
  }
}
