# AppContext-refaktorering

## Syfte

`AppContext` ersätter den tidigare `LoneberakningContext` och samlar all global state med **localStorage-persistens** på ett ställe. Målet är att:

1. **Löneinställningar** (anställningstyp, anciennitet, tillägg) sparas i `localStorage` och överlever sidladdningar.
2. **Kalenderdata per månad** (markerade pass, manuell tid, övertid) sparas via `saveMonth`/`loadMonth` så användaren inte förlorar data vid navigering.
3. **Parsad lönespec-data** från PDF-parsern sparas via `savePayslip` och är redo att importeras i lönemallen utan att filen behöver tolkas om.

`LoneberakningContext.tsx` behålls som en bakåtkompatibilitets-shim som re-exporterar allt från `AppContext.tsx`.

---

## Ändringar

### 1. `components/WorkCalendar.tsx`

**Problem:** Två duplicerade `useEffect`-block (load och save av månadsdata) använde variabeln `monthISO` innan den deklarerades, vilket gav TypeScript-felet *"Block-scoped variable 'monthISO' used before its declaration"*.

**Fix:** De tidiga duplicerade effekterna togs bort. De korrekta effekterna som redan fanns längre ned i filen — efter `const monthISO = format(currentMonth, 'yyyy-MM')` — behölls oförändrade.

### 2. `app/test/page.tsx`

**Problem:** Importen refererade till `data/schedules/ao_vinter_2025_26/Namdo.json`, en fil som inte existerade (mappen var tom). Build misslyckades med *"Module not found"*.

**Fix:** Importen ändrades till den faktiska filen `storage/ao/namdo-reg-bet-smrn-fartygsnr.json`.

### 3. `app/api/ao/upload/route.ts`

**Problem:** Objektet som pushades till `savedSheets` innehöll fältet `hasIsVariant`, men den explicita typdefinitionen för arrayen saknade detta fält. TypeScript-felet: *"Object literal may only specify known properties"*.

**Fix:** `hasIsVariant: boolean` lades till i typdefinitionen för `savedSheets`.

---

## Filer som inte ändrades

- `components/AppContext.tsx` — inga fel, redan korrekt.
- `components/LoneberakningContext.tsx` — shim, inga fel.
- `app/layout.tsx` — importerar `AppProvider` korrekt, inga fel.
- `app/page.tsx` — använder `useAppContext` korrekt, inga fel.
- `lib/salary/calculateMonthlySalary.ts` — beräkningslogik orördes.
- AO-parsern (`lib/ao/`) — orördes.
