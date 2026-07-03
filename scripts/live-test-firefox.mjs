/**
 * Live-test i FIREFOX mot prod, i två faser med samma profil:
 *   Fas 1: tolka PDF → spara → stäng webbläsaren helt
 *   Fas 2: starta om Firefox → gå till kalendern → hitta sparad spec
 * Testar både flödet och att localStorage överlever en omstart.
 * Kör: node scripts/live-test-firefox.mjs
 */
import { firefox } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'https://svett-salt-siffror.netlify.app';
const PDF = 'C:\\Users\\schro\\Downloads\\Lönespecifikation 202605 Johan Trygg-Schröder.pdf';
const PROFILE = path.join(os.tmpdir(), 'lonetolkaren-ff-profile');

fs.rmSync(PROFILE, { recursive: true, force: true });

const log = (step, data) => console.log(`[${step}]`, typeof data === 'string' ? data : JSON.stringify(data));

// ── Fas 1: spara ────────────────────────────────────────────────────────────
{
  const ctx = await firefox.launchPersistentContext(PROFILE, { headless: true });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('pageerror', (e) => console.log('[PAGE ERROR]', e.message));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  log('1', `Firefox laddade sidan: ${await page.title()}`);

  await page.setInputFiles('input[type="file"]', PDF);
  await page.getByRole('button', { name: 'Tolka lönespecifikation', exact: true }).click();

  const saveBtn = page.getByRole('button', { name: /spara till löneberäkning/i });
  await saveBtn.waitFor({ state: 'visible', timeout: 30000 });
  log('2', 'Tolkning klar i Firefox');

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
  log('3', { sparadeNycklar: keys });

  await ctx.close();
  log('4', 'Firefox stängd helt');
}

// ── Fas 2: starta om och leta ───────────────────────────────────────────────
{
  const ctx = await firefox.launchPersistentContext(PROFILE, { headless: true });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  await page.goto(`${BASE}/loneberakning`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const keysAfterRestart = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('loneberakning:payslip:'))
  );
  log('5', { nycklarEfterOmstart: keysAfterRestart });

  const monthOf = async () =>
    (await page.locator('h2').allInnerTexts()).find((t) =>
      /^(Januari|Februari|Mars|April|Maj|Juni|Juli|Augusti|September|Oktober|November|December)$/.test(t.trim())
    )?.trim();

  for (let i = 0; i < 12 && (await monthOf()) !== 'April'; i++) {
    await page.getByRole('button', { name: 'Föregående månad' }).click();
    await page.waitForTimeout(150);
  }

  await page.getByRole('button', { name: 'Ladda lönespec' }).click();
  await page.waitForTimeout(800);

  const bodyText = await page.locator('body').innerText();
  log('6', {
    manad: await monthOf(),
    hittadeSpec: bodyText.includes('Lönespecifikation 202605'),
    importKnapp: await page
      .getByRole('button', { name: 'Importera från lönespec' })
      .isVisible()
      .catch(() => false),
    toast: bodyText.match(/Ingen sparad lönespec[^\n]*/)?.[0] ?? null,
  });

  await ctx.close();
}

log('KLART', 'Firefox-livetest genomfört');
