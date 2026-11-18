/**
 * Löser upp `@/...` till projektroten när testerna körs av Nodes testkörare.
 *
 * Next och tsconfig mappar `@/*` till projektroten, men Node känner inte till
 * den mappningen. Utan den här kroken stupar varje test som råkar importera
 * en modul med en riktig körtidsimport — t.ex. lönemodulen, som hämtar
 * helgdagsreglerna via `@/lib/ao/holidayRules`.
 */

import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const KANDIDATER = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

function arFil(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const bas = path.join(rot, specifier.slice(2));
  for (const andelse of KANDIDATER) {
    const kandidat = `${bas}${andelse}`;
    if (arFil(kandidat)) {
      return nextResolve(pathToFileURL(kandidat).href, context);
    }
  }

  return nextResolve(specifier, context);
}
