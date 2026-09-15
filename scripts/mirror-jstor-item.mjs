import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT = path.resolve('jstor-item-original');
const url = 'https://www.jstor.org/stable/2900495';
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'pages'), { recursive: true });
await fs.mkdir(path.join(OUT, 'hosts'), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const seen = new Set();
const resources = [];

function localPathFor(rawUrl) {
  const u = new URL(rawUrl);
  let p = decodeURIComponent(u.pathname || '/');
  if (p.endsWith('/')) p += 'index';
  if (!path.extname(p)) p += '.bin';
  if (u.search) {
    const h = crypto.createHash('sha1').update(u.search).digest('hex').slice(0, 10);
    const e = path.extname(p);
    p = p.slice(0, -e.length) + `__q_${h}` + e;
  }
  p = p.replace(/[:*?"<>|]/g, '_');
  return path.join(OUT, 'hosts', u.hostname, p.replace(/^\/+/, ''));
}

async function saveResponse(response) {
  try {
    const type = response.request().resourceType();
    if (!['stylesheet', 'script', 'font', 'image'].includes(type)) return;
    const u = response.url();
    if (!/^https?:/.test(u) || seen.has(u)) return;
    seen.add(u);
    const body = await response.body();
    if (body.length > 15_000_000) return;
    const dest = localPathFor(u);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    resources.push({ url: u, type, status: response.status(), contentType: response.headers()['content-type'] || '', file: path.relative(OUT, dest).replaceAll('\\', '/') });
  } catch (e) { console.warn('skip', response.url(), e.message); }
}

const page = await context.newPage();
page.on('response', r => { void saveResponse(r); });
const main = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(15000);
if (main) {
  try { await fs.writeFile(path.join(OUT, 'pages', 'item.raw.html'), await main.body()); } catch {}
}
await fs.writeFile(path.join(OUT, 'pages', 'item.rendered.html'), await page.content(), 'utf8');
await page.screenshot({ path: path.join(OUT, 'item.png'), fullPage: true });

const challenge = /Client Challenge|captchaContainer|fastlyLogo/i.test(await page.content());
if (!challenge) {
  const controls = await page.locator('body').innerText();
  await fs.writeFile(path.join(OUT, 'viewer-text.txt'), controls, 'utf8');
  await page.waitForTimeout(5000);
}

await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), url, challenge, resources }, null, 2));
await browser.close();
console.log(`challenge=${challenge} assets=${resources.length}`);
