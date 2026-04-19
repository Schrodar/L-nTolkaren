# AO-parserns specialfall — detaljerad dokumentation

## Bakgrund

AO-schemat (Arbetsordningen) är en Excel-fil med ett blad per fartyg. Varje blad
innehåller ett eller flera **block** — perioder med tillhörande veckoschema och
datumspecifika undantag. Parsern (`lib/ao/parseAoWorkbook.ts`) läser dessa block
och sparar dem som JSON i `storage/ao/`.

Det finns **två typer av AO-filer** med fundamentalt olika struktur, och inom
vinter-AO finns dessutom fartyg med komplex flercrew-struktur.

---

## Filtyp 1: Vinter-AO

**Exempelfil:** `Ao_Vinter_2025-26_Däck_utg260203.xlsx`  
**Giltighetsperiod:** En sammanhängande period, t.ex. `2025-12-13 t.o.m. 2026-03-31`

### Enkel vinter-struktur (Waxholm II)

```
rad 7:  Gäller: 2025-12-15 t.o.m. 2026-04-01
rad 12: 2025-12-15 t.o.m. 2026-04-01          ← Block 0: ett schema, ingen is-markering
rad 16-23: mån–sön schema
rad 27-31: undantag (14.12, 24.12 etc.)
```

Parsad struktur:
```json
{
  "validPeriods": [{"from": "2025-12-15", "to": "2026-04-01"}],
  "hasIsVariant": false,
  "blocks": [
    { "crewIndex": 0, "mode": "isfri", "modeExplicit": false,
      "periodStart": "2025-12-15", "periodEnd": "2026-04-01",
      "extraPeriods": [], "weeklySchedule": [7 rader] }
  ]
}
```

**UI-konsekvens:** Islägesväljaren visas INTE (hasIsVariant = false).

---

### Komplex vinter-struktur (Nämdö) — flercrew + blandat isläge

Nämdö kör flera turlinjer parallellt med upp till tre besättningar (crews).
Varje period har tre block: ett per crew, med olika islägen.

```
rad 12: 2025-12-16 t.o.m. 2026-01-06 (Isfri period tabell 2 ... samt tabell 13 Ingmarsö)
        → Block 0: crew 0, mode=isfri, modeExplicit=true
rad 39: 2025-12-16 t.o.m. 2026-01-06 (Isperiod tabell 2 ... samt isfri period tabell 13 Ingmarsö)
        → Block 1: crew 1, mode=is, modeExplicit=true   ← BLANDAT i rubriken
rad 66: 2025-12-16 t.o.m. 2026-01-06 (Isperiod tabell 2 ... samt tabell 13 Ingmarsö)
        → Block 2: crew 2, mode=is, modeExplicit=true

rad 93: 2026-01-07 t.o.m. 2026-04-01 (Isfri period ...)
        → Block 3: crew 0, mode=isfri, modeExplicit=true
rad 107: 2026-01-07 t.o.m. 2026-04-01 (Isperiod ... samt isfri period tabell 13 ...)
         → Block 4: crew 1/2, mode=is, modeExplicit=true
```

#### Kritisk detalj: prioritetsordning i detectMode()

Rubriken för block 1 innehåller BÅDA "Isperiod" och "isfri":
```
"Isperiod tabell 2 Stockholm / tabell 3 Norra Lagnö / tabell 4 Ramsö,
 samt isfri period tabell 13 Ingmarsö"
```

`detectMode()` kollar `isperiod` FÖRE `isfri`. Om ordningen vore omvänd
skulle alla blandade block få fel mode=isfri. Ändra inte denna prioritet.

```typescript
// KORREKT ordning i detectMode():
if (lower.includes("isperiod") || lower.includes("is-period")) {
  return { mode: "is", explicit: true };   // ← kollas FÖRST
}
if (lower.includes("isfri")) {
  return { mode: "isfri", explicit: true };
}
```

#### crewIndex-räkning

`crewIndex` bestäms av hur många block som redan har samma primärperiod:
```
Block 0: period="2025-12-16|2026-01-06" → crewIndex=0
Block 1: period="2025-12-16|2026-01-06" → crewIndex=1
Block 2: period="2025-12-16|2026-01-06" → crewIndex=2
Block 3: period="2026-01-07|2026-04-01" → crewIndex=0 (ny period, räknar om)
Block 4: period="2026-01-07|2026-04-01" → crewIndex=1
```

#### Flercrew i UI — hur det fungerar

En dag med tre crews visar tre klickbara punkter i kalendercellen — en per crew.
Användaren vet vilket crew de tillhör och klickar bara i sin egen punkt.
De andra punkterna lämnas oklickade. Detta är korrekt och avsiktligt beteende —
inget crew-val behövs i förväg eftersom användaren väljer implicit genom att
klicka på rätt pass.

Gäller alla båtar med flercrew-struktur, inte bara Nämdö.

**UI-konsekvens:** Islägesväljaren visas (hasIsVariant = true). Användaren
väljer is eller isfri — getAoForDate() hämtar rätt block baserat på mode.

---

## Filtyp 2: Vår/höst-AO

**Exempelfil:** `Ao_VårHöst_2026_Däck_260409.xlsx`  
**Giltighetsperiod:** Två icke-sammanhängande perioder med sommarlucka emellan.

### Giltighetstiden är uppdelad på TWÅ rader

```
rad 7:  "Gäller: 2026-04-01 t.o.m. 2026-06-14 samt"    ← rad 7
rad 8:  "2026-08-19 t.o.m. 2026-12-11"                  ← rad 8 (fortsättning)
```

`extractMeta()` slår ihop rad 7 + rad 8 för att fånga båda intervallen:
```typescript
const twoLines = `${combined} ${nextCombined}`;
const periods = extractAllPeriods(twoLines);
// → [{ from: "2026-04-01", to: "2026-06-14" },
//    { from: "2026-08-19", to: "2026-12-11" }]
```

### Block-rubriker med dubbla intervall

Varje schema-block täcker båda perioderna i en och samma rubrik:
```
"2026-04-02 t.o.m. 2026-05-07 samt 2026-09-14 t.o.m. 2026-12-11"
```

`extractAllPeriods()` hittar båda via global regex och sparar dem i `extraPeriods`:
```json
{
  "periodStart": "2026-04-02",
  "periodEnd": "2026-05-07",
  "extraPeriods": [{ "from": "2026-09-14", "to": "2026-12-11" }]
}
```

`blockCoversDate()` i `aoparser.ts` kollar BÅDE primärperiod och extraPeriods:
```typescript
function blockCoversDate(block: AoBlock, isoDate: string): boolean {
  if (isoDate >= block.periodStart && isoDate <= block.periodEnd) return true;
  for (const extra of block.extraPeriods ?? []) {
    if (isoDate >= extra.from && isoDate <= extra.to) return true;
  }
  return false;
}
```

**Utan detta skulle höst-datum (sep–dec) aldrig matcha något block.**

### Ingen is-variant i vår/höst

Vår/höst-AO saknar helt is/isfri-text i rubrikerna → alla block får
`modeExplicit: false` → `hasIsVariant: false` på hela sheeten.

**UI-konsekvens:** Islägesväljaren visas INTE. WorkCalendar återställer
automatiskt `selectedMode = 'isfri'` när en vår/höst-AO laddas.

---

## Nämdö vår/höst — känt problem

Den uppladdade vår/höst-AO:n för Nämdö har en trasig period i ett block:
```
heading: "2026-04-07 t.o.m. 2025-05-07"
```
Årtalet 2025 är fel (borde vara 2026). Detta är ett fel i källfilen.
Konsekvens: blocket matchas aldrig eftersom `periodEnd < periodStart`.

**Åtgärd:** Inget att göra i koden — felets ursprung är Excel-filen.
När en ny korrekt AO-fil levereras och laddas upp löser det sig.

---

## Sommarluckan

Vår/höst-AO täcker april–juni + aug–dec. Juli täcks inte.
Under juli hittar `getAoForDate()` inga matchande block → returnerar `null`
→ WorkCalendar visar tomma celler utan schema.

Detta är korrekt beteende — ingen AO-data finns för sommarsäsongen
(midsommar–midsommar är ofta charter/specialtrafik med eget schema).

---

## DEBUG-läge

Sätt miljövariabeln `DEBUG_AO=1` för verbose parsnings-loggning i terminalen:
```bash
DEBUG_AO=1 npm run dev
```

Loggar varje block, veckodagsrad och undantagsrad med period, mode och tider.

---

## Bakåtkompatibilitet

`loadParsedAoSheet()` i `storage.ts` fyller i nya fält automatiskt för
äldre JSON-filer som saknar dem:
- `validPeriods` → byggs från `validFrom`/`validTo`
- `hasIsVariant` → räknas om från `blocks[].mode === "is"`
- `extraPeriods` → sätts till `[]`
- `modeExplicit` → sätts till `true`
- `crewIndex` → sätts till `0`

## Vad är Lönetolkaren?

Next.js 16 + TypeScript + Tailwind v4-app för sjömän anställda under **Skärgårdsavtalet**
(Almega/Seko, 1 okt 2025 – 30 sep 2027). Inga externa databaser — all data lagras lokalt.

Två huvuddelar:
1. **`/` — Lönespecifikations-parsern**: Ladda upp PDF-lönespec → tolka art-grupper
2. **`/loneberakning` — Löneberäkningsmallen**: Välj båt + markera arbetade pass → få ut estimerad bruttolön

---

## Teknikstack

- Next.js 16.1.6, React 19, TypeScript, Tailwind CSS v4
- Inga externa databaser — AO-scheman sparas som JSON i `storage/ao/`
- `storage/ao/*.json` är i `.gitignore` (genererad data, laddas upp via UI)

---

## Filstruktur — viktiga filer

```
app/
  page.tsx                          # Lönespec-parsern (PDF-upload)
  loneberakning/page.tsx            # Löneberäknings-sidan
  loneberakning/ao/page.tsx         # AO-uppladdnings-admin
  api/ao/upload/route.ts            # POST: ta emot AO Excel → parsa → spara JSON
  api/ao/sheets/route.ts            # GET: lista sparade AO-scheman
  api/ao/sheets/[slug]/route.ts     # GET/DELETE: hämta/ta bort ett schema

components/
  WorkCalendar.tsx                  # Kalender + summering + löneberäkning
  DayModal.tsx                      # Modal per dag: schema, manuell tid, övertid
  TariffEditor.tsx                  # Välj anställningstyp + anciennitetsnivå
  LoneberakningContext.tsx          # Delad state: tariff, tillägg, år
  AoUpload.tsx                      # Uppladdningsknapp för AO Excel
  BoatSelect.tsx                    # Dropdown för båtval

lib/
  ao/types.ts                       # Typer: AoBlock, ParsedAoSheet, AoPeriod, etc.
  ao/parseAoWorkbook.ts             # Excel-parser för AO-scheman
  ao/storage.ts                     # Läs/skriv JSON-filer i storage/ao/
  ao/resolveAoDay.ts                # Slå upp rätt AO-rad för ett datum
  ao/holidayRules.ts                # Svenska helgdagar + OB-dagtyper
  aoparser/aoparser.ts              # getAoForDate() — hittar block + rad
  salary/calculateMonthlySalary.ts  # Löneberäkning enligt avtalet
  tariffs/defaultTariffs.ts         # Tariffer 2025-10-01 och 2026-10-01
  tariffs/types.ts                  # TariffTable, TenureKey, etc.
  calendar/types.ts                 # DayEntry, MonthState (ej fullt använd ännu)
```

---

## Avtalsregler implementerade i calculateMonthlySalary.ts

### OB (§ 7)
- **Alla dagar kl 00–06**: natt-OB
- **Storhelger** (påsk, pingst, midsommar, jul, nyår): OB kl 00–24 på helgdagsafton + helgdag
- **Småhelger** (trettondagen, 1 maj, Kristi himmelsfärd, 6 juni, Alla helgons dag): OB kl 00–24 på dag-före + helgdag
- Dag efter storhelg/småhelg: kl 00–06 (täcks av natt-OB)
- OB-sats: **månadslön ÷ 300** per timme
- Beräknas exakt med `ShiftSpan` (workStart/workEnd från AO) via `overlapMinutes()`

### Övertid (§ 6.3)
- Vardag (inkl. fredag): **månadslön ÷ 104**
- Lördag/söndag/helg: **månadslön ÷ 72**

### Timlön (§ 11.2 + Bilaga 1)
- Säsong/vikarie: **månadslön ÷ 152**
- Korttid: **månadslön ÷ 145**

### Tillägg (Bilaga 1)
| Tillägg | 2025 | 2026 |
|---------|------|------|
| 1:e däcksman | 2 721 kr/mån | 2 802 kr/mån |
| Båtsman/1:e motorman m.fl. | 1 600 kr/mån | 1 648 kr/mån |
| Rederitillägg 3 år | 422 kr/mån | 434 kr/mån |
| Rederitillägg 6 år | 530 kr/mån | 546 kr/mån |
| Rederitillägg 9 år | 655 kr/mån | 674 kr/mån |
| Maskinskötstillägg | 165 kr/dag | 170 kr/dag |

---

## AO-parsern — viktiga detaljer

### Stöder två filformat
- **Vinter-AO** (`Ao_Vinter_2025-26_Däck_utg260203.xlsx`): en period, kan ha is/isfri-varianter
- **Vår/höst-AO** (`Ao_VårHöst_2026_Däck_260409.xlsx`): två perioder i samma fil (`2026-04-01 t.o.m. 2026-06-14 samt 2026-08-19 t.o.m. 2026-12-11`)

### Nya fält på AoBlock (lib/ao/types.ts)
- `extraPeriods: AoPeriod[]` — extra datumintervall (vår+höst i samma block)
- `modeExplicit: boolean` — om blocket explicit nämner is/isfri
- `crewIndex: number` — besättningsindex (0, 1, 2...) för flercrew-båtar

### Nya fält på ParsedAoSheet
- `validPeriods: AoPeriod[]` — alla giltighetsperioder (en för vinter, två för vår/höst)
- `hasIsVariant: boolean` — om filen innehåller is/isfri-varianter

### islägesväljaren i UI
- Visas **bara** om `aoSheet.hasIsVariant === true`
- Återställs automatiskt till `isfri` om en sommarsäsong laddas

### Nämdö-problemet (blandat isläge)
Nämdö har block med rubriken: _"Isperiod tabell 2 ... samt isfri period tabell 13 Ingmarsö"_
`detectMode()` prioriterar `isperiod` före `isfri` → korrekt `mode=is` för dessa block.

---

## Nuvarande state i WorkCalendar

```
activeShifts: Set<string>         # "2026-04-13::0" (datum::passindex)
manualHoursByDate: Record<string, number>   # manuellt inmatad ordinarie tid
overtimeByDate: Record<string, number>      # övertidstimmar per datum
savedHours / savedShiftCount               # sparade timmar vid båtbyte
```

**OBS:** All state försvinner vid sidladdning — ingen persistens finns ännu.

---

## Vad som fungerar ✅

- AO-parser hanterar vinter + vår/höst korrekt
- Islägesväljare döljs automatiskt för sommarsäsong
- Uppladdning av AO via UI (`/loneberakning`)
- Kalender visar schemat per dag (markera/avmarkera pass)
- DayModal: visa schema, mata in manuell ordinarie tid, mata in övertid
- OB-beräkning: exakt överlapp med natt 00–06 + helgdagar
- Summering i kronor: grundlön, OB, övertid, tillägg, total bruttolön
- Summering visas när pass markeras ELLER manuell tid/övertid matas in

---

## Vad som saknas / ska byggas ❌

### 1. Månadslagring (prioritet 1)
All state i WorkCalendar försvinner vid sidladdning. Behöver:
- Spara `activeShifts`, `manualHoursByDate`, `overtimeByDate` per månad i `localStorage`
- Nyckelformat: `loneberakning:2026-04` (år-månad)
- Läs in automatiskt när månaden öppnas
- Spara automatiskt när data ändras

Förslag på datastruktur per månad:
```ts
type SavedMonth = {
  monthISO: string;           // "2026-04"
  boatSlug: string;           // "soderarm-reg-bet-sbfw-fartygsnr"
  mode: AoMode;               // "is" | "isfri"
  activeShifts: string[];     // ["2026-04-13::0", ...]
  manualHoursByDate: Record<string, number>;
  overtimeByDate: Record<string, number>;
  savedAt: string;            // ISO-timestamp
};
```

### 2. Årsöversikt (prioritet 2)
Ny sida eller panel som visar alla sparade månader i en tabell:

| Månad | Timmar | Grundlön | OB | Övertid | Tillägg | **Totalt** |
|-------|--------|----------|----|---------|---------|-----------|
| Jan   | 168 h  | 25 051   | 0  | 800     | 655     | **27 506** |
| ...   |        |          |    |         |         |            |
| **År**| **Σ** | **Σ** | **Σ** | **Σ** | **Σ** | **Σ** |

- Räknar om varje månad med `calculateMonthlySalary()`
- Visar totalt för hela året

### 3. Export (prioritet 3)
- Export till PDF eller Excel av månads- eller årssammanställning
- Använd befintlig PDF-skill eller xlsx-skill

### 4. Koppla lönespec-parsern till kalender
- Sida `/` kan parsa en lönespec-PDF
- Logik finns i `lib/calendar/importFromPayslip.ts` men är inte kopplad till WorkCalendar
- Ska kunna importera övertid/VAB/semester från lönespec direkt in i kalender

---

## Kända buggar / förbättringsområden

- `calculateMonthlySalary.ts` har kvar felaktig kommentar i fil-toppen som säger "fredag → OB hela dygnet" — detta är **fel**, ska vara "bara 00–06". Uppdatera kommentaren.
- `lib/calendar/types.ts` (`DayEntry`) är inte integrerad med WorkCalendar — används bara av äldre kod. Kan städas upp eller ersätta den nuvarande state-strukturen.
- OB-kommentaren i toppen av `calculateMonthlySalary.ts` stämmer inte med implementationen — fix: ta bort raderna om `'fredag' → OB hela dygnet` i kommentarblocket.

---

## Avtalsdokument
`skargardstrafik-2025-2027_webb_final.pdf` finns i `public/` — kollektivavtalet som all beräkningslogik baseras på.

---

## Commit-historik (senaste)
- `uppdatera AO-parser: stöd för vår/höst-perioder, extraPeriods, modeExplicit, crewIndex, hasIsVariant — ta bort gamla AO JSON-filer`