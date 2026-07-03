/**
 * End-to-end-test av lönespec-flödet mot LIVE-sajten.
 * Kör: node scripts/live-test.mjs
 * PDF:en parsas client-side i headless Chromium — den laddas aldrig upp någonstans.
 */
import { chromium } from 'playwright';

const BASE = 'https://svett-salt-siffror.netlify.app';
const PDF = 'C:\\Users\\schro\\Downloads\\Lönespecifikation 202605 Johan Trygg-Schröder.pdf';

const log = (step, data) => console.log(`[${step}]`, typeof data === 'string' ? data : JSON.stringify(data));

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[PAGE ERROR]', e.message));

// ── 1. Lönespec-sidan: ladda upp + tolka ────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
log('1', `Sidan laddad: ${await page.title()}`);

await page.setInputFiles('input[type="file"]', PDF);
await page.getByRole('button', { name: 'Tolka lönespecifikation', exact: true }).click();
log('2', 'Tolkning startad...');

const saveBtn = page.getByRole('button', { name: /spara till löneberäkning/i });
await saveBtn.waitFor({ state: 'visible', timeout: 30000 });
log('3', 'Tolkning klar — spara-knappen synlig');

// ── 2. Spara ────────────────────────────────────────────────────────────────
await saveBtn.click();
await page.waitForTimeout(600);
const overwrite = page.getByRole('button', { name: /skriv över/i });
if (await overwrite.isVisible().catch(() => false)) {
  await overwrite.click();
  await page.waitForTimeout(400);
}

const keys = await page.evaluate(() =>
  Object.keys(localStorage).filter((k) => k.startsWith('loneberakning:payslip:'))
);
log('4', { sparadeNycklar: keys });

// ── 3. Kalendern: hitta specen i april ──────────────────────────────────────
await page.goto(`${BASE}/loneberakning`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const monthOf = async () =>
  (await page.locator('h2').allInnerTexts()).find((t) =>
    /^(Januari|Februari|Mars|April|Maj|Juni|Juli|Augusti|September|Oktober|November|December)$/.test(t.trim())
  )?.trim();

for (let i = 0; i < 12 && (await monthOf()) !== 'April'; i++) {
  await page.getByRole('button', { name: 'Föregående månad' }).click();
  await page.waitForTimeout(150);
}
log('5', `Månad i kalendern: ${await monthOf()}`);

await page.getByRole('button', { name: 'Ladda lönespec' }).click();
await page.waitForTimeout(800);

const bodyText = await page.locator('body').innerText();
const foundFile = bodyText.includes('Lönespecifikation 202605');
const importBtnVisible = await page
  .getByRole('button', { name: 'Importera från lönespec' })
  .isVisible()
  .catch(() => false);
const toast = bodyText.match(/Ingen sparad lönespec[^\n]*/)?.[0] ?? null;
log('6', { hittadeSpec: foundFile, importKnapp: importBtnVisible, toast });

// ── 4. Importera ────────────────────────────────────────────────────────────
if (importBtnVisible) {
  await page.getByRole('button', { name: 'Importera från lönespec' }).click();
  await page.waitForTimeout(1200);
  const after = await page.locator('body').innerText();
  log('7', {
    mDagar: (after.match(/dagar × \d+ kr\/dag/) ?? ['—'])[0],
    avvikelser: (after.match(/\d+,\d+ h löns\./g) ?? []).length,
    brutto: (after.match(/Estimerad bruttolön\s*\n\s*([\d\s]+) kr/) ?? [, '—'])[1]?.trim(),
  });
}

await browser.close();
log('KLART', 'Live-testet genomfört');
