import { chromium } from 'playwright';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 2048, height: 1120 },
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', req => errors.push(`requestfailed: ${req.url()} :: ${req.failure()?.errorText || ''}`));

await page.goto('http://127.0.0.1:4173/?visual-check=1', {
  waitUntil: 'networkidle',
  timeout: 90_000
});
await page.evaluate(async () => {
  try { await document.fonts.ready; } catch {}
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);

const diagnostics = await page.evaluate(() => ({
  title: document.querySelector('.homepage-heading')?.getBoundingClientRect().toJSON?.() || null,
  search: document.querySelector('#home-search-form')?.getBoundingClientRect().toJSON?.() || null,
  hero: document.querySelector('.homepage-container')?.getBoundingClientRect().toJSON?.() || null,
  templatesRemaining: document.querySelectorAll('template[shadowrootmode]').length,
  shadowRoots: Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot).length,
  bodyScrollWidth: document.body.scrollWidth,
  bodyScrollHeight: document.body.scrollHeight,
  fonts: Array.from(document.fonts).map(f => ({ family: f.family, status: f.status })).slice(0, 30)
}));

await page.screenshot({ path: 'artifacts/homepage.png', fullPage: false });
await fs.writeFile('artifacts/diagnostics.json', JSON.stringify({ diagnostics, errors }, null, 2));
console.log(JSON.stringify({ diagnostics, errors }, null, 2));
await browser.close();
