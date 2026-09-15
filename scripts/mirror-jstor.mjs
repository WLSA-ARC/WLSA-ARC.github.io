import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT = path.resolve('jstor-original');
const targets = [
  ['home', 'https://www.jstor.org/'],
  ['search', 'https://www.jstor.org/action/doBasicSearch?Query=physics'],
  ['item', 'https://www.jstor.org/stable/20022815']
];

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'pages'), { recursive: true });
await fs.mkdir(path.join(OUT, 'hosts'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
});

const seen = new Set();
const manifest = [];

function localPathFor(rawUrl) {
  const u = new URL(rawUrl);
  let p = decodeURIComponent(u.pathname || '/');
  if (p.endsWith('/')) p += 'index';
  const ext = path.extname(p);
  if (!ext) p += '.bin';
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
    const request = response.request();
    const type = request.resourceType();
    if (!['stylesheet', 'script', 'font', 'image'].includes(type)) return;
    const url = response.url();
    if (!/^https?:/.test(url) || seen.has(url)) return;
    seen.add(url);
    const headers = response.headers();
    const len = Number(headers['content-length'] || 0);
    if (len > 15_000_000) return;
    const body = await response.body();
    if (body.length > 15_000_000) return;
    const dest = localPathFor(url);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    manifest.push({ url, type, status: response.status(), contentType: headers['content-type'] || '', file: path.relative(OUT, dest).replaceAll('\\', '/') });
  } catch (e) {
    console.warn('resource skipped:', response.url(), e.message);
  }
}

for (const [name, url] of targets) {
  const page = await context.newPage();
  page.on('response', r => { void saveResponse(r); });
  console.log('capturing', url);
  const main = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(7000);

  if (main) {
    try {
      const raw = await main.body();
      await fs.writeFile(path.join(OUT, 'pages', `${name}.raw.html`), raw);
    } catch {}
  }
  await fs.writeFile(path.join(OUT, 'pages', `${name}.rendered.html`), await page.content(), 'utf8');

  if (name === 'item') {
    const candidates = [
      page.getByRole('link', { name: /read online|view online|view item/i }).first(),
      page.getByRole('button', { name: /read online|view online|view item/i }).first()
    ];
    for (const c of candidates) {
      try {
        if (await c.isVisible({ timeout: 1500 })) {
          await c.click();
          await page.waitForTimeout(7000);
          await fs.writeFile(path.join(OUT, 'pages', 'viewer.rendered.html'), await page.content(), 'utf8');
          break;
        }
      } catch {}
    }
  }
  await page.close();
}

await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), targets, resources: manifest }, null, 2));
await browser.close();
console.log(`saved ${manifest.length} production assets`);
