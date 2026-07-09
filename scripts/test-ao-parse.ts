import fs from "node:fs";
import { parseAoWorkbook } from "../lib/ao/parseAoWorkbook";

const file = process.argv[2];
const buf = fs.readFileSync(file);
const sheets = parseAoWorkbook(buf);

console.log(`Antal blad: ${sheets.length}`);
let boatsWithWork = 0;
for (const s of sheets) {
  const workRows = s.blocks.reduce(
    (sum, b) => sum + b.weeklySchedule.filter((r) => r.workStart).length,
    0
  );
  if (workRows > 0) boatsWithWork++;
  console.log(
    [
      s.sheetName.padEnd(24),
      `blad-namn=${(s.vesselName ?? "-").slice(0, 30).padEnd(30)}`,
      `perioder=${s.validPeriods.map((p) => `${p.from}..${p.to}`).join(",") || "-"}`,
      `block=${s.blocks.length}`,
      `arbetsrader=${workRows}`,
      `is=${s.hasIsVariant}`,
      s.parseErrors.length ? `FEL: ${s.parseErrors.join("; ")}` : "",
    ].join(" ")
  );
}
console.log(`Blad med arbetstider: ${boatsWithWork}/${sheets.length}`);
