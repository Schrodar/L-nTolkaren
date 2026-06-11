# Lönetolkaren

Webbapp för skärgårdstrafikens däckspersonal (Blidösundsbolaget m.fl.): tolkar lönespecifikationer (PDF) och jämför dem mot arbetsordningar (AO, Excel) för att räkna ut och verifiera lön. Next.js (App Router) + Tailwind, TypeScript.

## Kärnprincip: ingen databas, ingen serverlagring

**All användardata stannar i webbläsaren (localStorage).** Det är ett medvetet designval — vi slipper GDPR-hantering och användarna ska aldrig behöva misstänka att vi läser deras lönespecar.

- Lönespec-PDF:er parsas client-side med pdf.js och lämnar aldrig webbläsaren.
- AO-Excel skickas till `/api/ao/upload` för parsning men sparas inte på servern.
- Inför ALDRIG databas, server-side lagring av användardata eller analytics som fångar lönespec-innehåll. Ny persistens = localStorage (se `lib/ao/clientStore.ts`).

## Deployment

Deployas på **Netlify**. API-routes kör som serverless-funktioner med efemärt filsystem — `fs.writeFileSync` persisterar INTE i produktion. `storage/ao/` fungerar bara i lokal utveckling och är gitignorad.

## Arkitektur i korthet

- `app/page.tsx` — Lönespec-sidan: PDF-tolkning (pdf.js), art-grupper, sparas i localStorage.
- `app/loneberakning/` — kalender + löneberäkning; `hantera/` (data), `ao/` (AO-import).
- `components/WorkCalendar.tsx` — kalendern: AO-pass per dag, lönespec-import med automatisk grön/röd-markering (lönespecens art315-timmar matchas mot delmängder av dagens AO-pass — hanterar på/avmönstring med två pass samma dag).
- `lib/ao/clientStore.ts` — localStorage-lagring av AO (nyckel `lonetolkaren.ao.sheets.v2`). Flera utgåvor per båt (vinter + vår/höst); kalendern väljer utgåva vars `validPeriods` täcker visad månad. Överlappande perioder ersätts vid uppladdning.
- `lib/ao/parseAoWorkbook.ts` — AO-Excel-parser (block, veckoschema, undantag, is/isfri, vår/höst-perioder).
- `lib/summarizePayslipArtGroups.ts` — lönespec-arter (315 = ordinarie tid, 301/302 = övertid, 311/312 = komp, 700 = semester, 810 = VAB, 2101 = maskindagar). Art315 summeras per datum.

## Domänkunskap

- Lönespecen för månad X avser arbete i månad X−1 (januarispec = decembertider).
- AO-utgåvor revideras (t.ex. "utg260203") — tider kan skilja mot vad som faktiskt gällde tidigare i säsongen.
- Användare laddar själva ner senaste AO (knappar på sidan, filer i `public/`) och laddar upp den — sajtägaren behöver bara byta ut filen i `public/` vid ny utgåva.

## Verktyg

- `npx tsc --noEmit` för typkontroll, `npx eslint <filer>` för lint. Inga tester finns ännu.
- Dev-server: `npm run dev` (port 3000).
