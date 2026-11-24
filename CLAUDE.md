# Lönetolkaren

Webbapp för skärgårdstrafikens däckspersonal (Blidösundsbolaget m.fl.): tolkar lönespecifikationer (PDF) och jämför dem mot arbetsordningar (AO, Excel) för att räkna ut och verifiera lön. Next.js (App Router) + Tailwind, TypeScript.

## Kärnprincip: ingen databas, ingen serverlagring

**All användardata stannar i webbläsaren (localStorage).** Det är ett medvetet designval — vi slipper GDPR-hantering och användarna ska aldrig behöva misstänka att vi läser deras lönespecar.

- Lönespec-PDF:er parsas client-side med pdf.js och lämnar aldrig webbläsaren.
- AO-Excel parsas också client-side (`lib/ao/importAoFile.ts` → `parseAoWorkbook`) och lämnar aldrig webbläsaren. Det fanns tidigare ett `/api/ao/upload` som tog emot filen — borttaget, eftersom inget användarmaterial ska passera Netlify.
- Inför ALDRIG databas, server-side lagring av användardata eller analytics som fångar lönespec-innehåll. Ny persistens = localStorage (se `lib/ao/clientStore.ts`).

## Deployment

Deployas på **Netlify**. Appen har inga API-routes som tar emot användardata — allt tolkas och lagras i webbläsaren. Netlify ser därför bara vanlig trafikmetadata (IP, sökväg, tidpunkt), aldrig innehållet i någons lönespec eller AO.

Observera att skyddet vilar på att du kontrollerar bygget: den som styr utrullningen serverar också JavaScripten. Arkitekturen gör exfiltrering onödig, inte omöjlig.

## Arkitektur i korthet

- `app/page.tsx` — Lönespec-sidan: PDF-tolkning (pdf.js), art-grupper, sparas i localStorage.
- `app/loneberakning/` — kalender + löneberäkning; `hantera/` (data), `ao/` (AO-import).
- `components/WorkCalendar.tsx` — kalendern: AO-pass per dag, lönespec-import där art315-timmarna matchas mot delmängder av dagens AO-pass (hanterar på/avmönstring med två pass samma dag). Avvikelser färgas efter riktning: ljusgrönt när specen har fler timmar än AO, rött när den har färre. Båt kan sättas per dag (`boatByDate`, valbart i dagmodalen med "gäller resten av månaden") — AO-utgåvor hålls per båt i `sheetsByBoat` och jämförelsen körs om mot den nya båtens tider.
- `lib/ao/clientStore.ts` — localStorage-lagring av AO (nyckel `lonetolkaren.ao.sheets.v2`). Flera utgåvor per båt (vinter + vår/höst + sommar). Överlappande perioder ersätts vid uppladdning.
- `lib/ao/editions.ts` — väljer AO-utgåva **per dag** (`pickEditionForDate`), inte per månad, så att ett säsongsbyte mitt i månaden (t.ex. vår/höst t.o.m. 14 juni, sommar från 15 juni) mappas ut sömlöst. Utgåvan vars **schemablock** täcker dagen går före den vars rubrikdatum gör det: filernas rubriker och block går inte alltid i takt (vinter-AO:n säger t.o.m. 2026-03-31 men har schema t.o.m. 2026-04-01, medan vår/höst-rubriken börjar 2026-04-01 fast schemat börjar 04-02). `editionStartsInMonth` ger dagarna där en ny utgåva börjar gälla → "Ny AO"-notering i kalendern. Utgåvor utan is-variant körs alltid som `isfri`.
- `lib/ao/parseAoWorkbook.ts` — AO-Excel-parser (block, veckoschema, undantag, is/isfri, vår/höst-perioder). Körs i webbläsaren; `xlsx` importeras dynamiskt så att biblioteket bara hämtas vid uppladdning.
- `lib/summarizePayslipArtGroups.ts` — lönespec-arter (315 = ordinarie tid, 301/302 = övertid, 311/312 = komp, 483 = plustid, 700 = semester, 800/80001/80002/806 = sjukdom, 810/81001 = VAB, 2101 = maskindagar). Art315 summeras per datum.
  - **Bruttolönen summeras ur raderna, aldrig ur art9991.** `bruttoBerakat` är summan av de inkomstarter vi själva tolkar, och `netto` räknas på den. Specens egen bruttolön (art9991) läses bara för att jämföras mot: skillnaden hamnar i `bruttoAvvikelse` och ger en varning i lönebeskedet vid ≥ 1 kr. Tidigare användes 9991 som bruttolön, vilket dolde varje art vi missade — en spec där slutlönen inte tolkades visade ändå rätt belopp, och de 21 951,76 kronorna gick bara att hitta genom att jämföra utanför appen. Inför aldrig `bruttoFranSpec ?? bruttoBerakat` igen.
  - **Art-rader kan brytas över flera rader.** I slutlönesektionen står arten ensam på sin rad med en underrubrik emellan, och datum och belopp kommer på raden efter ("301 Övertid" / "Slutlön årsarbetstid" / "2026-09-01 - 2026-09-01 40,69 255,68 10 403,73"). Saknar art-raden både datumintervall och belopp väntar parsern på nästa datumrad. Utan det föll hela slutlönen (21 951,76 kr) ur bruttolönen.
  - **Sjukdom:** fyra arter hör ihop. **art800** är själva frånvarotiden (flerdagarsintervall som klumpsumma, `rangesISO`), **art80001** karenstillfället (de första timmarna, avdrag med full timlön), **art80002** dag 2-14 (avdrag med 20 % av timlönen) och **art806** sjuk-OB (en intäkt). art80001 + art80002 har tillsammans lika många timmar som art800. Kalendern måste använda art800 för att markera dagarna — att bara titta på art80001 missar hela dag 2-14, vilket gjorde att en frånvaro 16–21 september renderade 18–21 som vanliga arbetsdagar. Sjukavdraget summeras ur specens belopp (80001 + 80002), aldrig framräknat på ett eget timpris, eftersom de två har olika á-pris. Precis som vid VAB ligger art315 kvar som nominell tid under frånvaron, så timmarna finns redan i jämförelsen mot AO; frånvaron fördelas över intervallet viktat mot art315 + art483. Tester i `lib/sjukdom.test.ts`.
  - **VAB:** art315 är *nominell* tid och ligger kvar under frånvaron (räknas in i årsarbetstiden de första 14 dagarna) — VAB-timmarna ingår alltså redan i jämförelsen mot AO. Faktiskt arbetad tid = art315 − art810. Specens flerdagarsintervall (`rangesISO`) fördelas i kalendern proportionellt mot art315 per dag så att intervallets summa bevaras. Löneavdraget tas direkt från art81001 (`sekByDateISO`) i stället för att räknas fram — specens á-pris följer inte tariffens divisorer.
- `lib/traktamente/` — obetalt traktamente (övernattning ombord): dagar markeras manuellt i dagmodalen och sparas per månad (`traktamenteDates` + `natthamnByDate`); natthamnar återanvänds via `knownNatthamnar` i inställningarna. `buildTraktamenteRows` bygger årslistan (tider från AO, sluttiden uppskriven om lönespecen har fler timmar) och `traktamentePdf` renderar PDF:en med jsPDF client-side.

## Domänkunskap

- Lönespecen för månad X avser arbete i månad X−1 (januarispec = decembertider).
- AO-utgåvor revideras (t.ex. "utg260203") — tider kan skilja mot vad som faktiskt gällde tidigare i säsongen.
- Användare laddar själva ner senaste AO (knappar på sidan, filer i `public/`) och laddar upp den — sajtägaren behöver bara byta ut filen i `public/` vid ny utgåva.

## Verktyg

- `npx tsc --noEmit` för typkontroll, `npx eslint <filer>` för lint. Inga tester finns ännu.
- Dev-server: `npm run dev` (port 3000).
