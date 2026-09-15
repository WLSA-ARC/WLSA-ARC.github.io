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
  // Match the 2048px desktop reference capture. The page's own responsive CSS
  // remains in the snapshot; this also freezes carousel geometry at the reference width.
  viewport: { width: 2048, height: 1200 },
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
});

// Keep a reference even to closed shadow roots so the static snapshot can preserve
// the exact rendered component tree. This does not change the site's behavior.
await context.addInitScript(() => {
  const original = Element.prototype.attachShadow;
  Object.defineProperty(Element.prototype, '__captureShadowRoot', {
    configurable: true,
    get() { return this.__captureShadowRootValue || null; },
    set(v) { this.__captureShadowRootValue = v; }
  });
  Element.prototype.attachShadow = function(init) {
    const root = original.call(this, init);
    try {
      Object.defineProperty(this, '__captureShadowRootValue', {
        configurable: true,
        value: root
      });
    } catch {}
    return root;
  };
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

async function serializeRenderedDocument(page) {
  return page.evaluate(() => {
    const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const RAW_TEXT = new Set(['script', 'style']);

    const escapeText = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const escapeAttr = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

    function sheetText(sheet) {
      try {
        return Array.from(sheet.cssRules || [], r => r.cssText).join('\n');
      } catch {
        return '';
      }
    }

    function serialize(node, parentTag = '') {
      if (node.nodeType === Node.TEXT_NODE) {
        return RAW_TEXT.has(parentTag) ? node.data : escapeText(node.data);
      }
      if (node.nodeType === Node.COMMENT_NODE) {
        return `<!--${node.data}-->`;
      }
      if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
        return `<!DOCTYPE ${node.name}>`;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      const attrs = Array.from(node.attributes, a => ` ${a.name}="${escapeAttr(a.value)}"`).join('');
      const start = `<${tag}${attrs}>`;
      if (VOID.has(tag)) return start;

      let inner = '';
      const root = node.shadowRoot || node.__captureShadowRoot;
      if (root) {
        let shadowInner = '';
        try {
          for (const sheet of root.adoptedStyleSheets || []) {
            const css = sheetText(sheet);
            if (css) shadowInner += `<style data-captured-adopted-stylesheet>${css}</style>`;
          }
        } catch {}
        shadowInner += Array.from(root.childNodes, child => serialize(child, '')).join('');
        inner += `<template shadowrootmode="${root.mode || 'open'}">${shadowInner}</template>`;
      }

      inner += Array.from(node.childNodes, child => serialize(child, tag)).join('');
      return `${start}${inner}</${tag}>`;
    }

    let adopted = '';
    try {
      for (const sheet of document.adoptedStyleSheets || []) {
        const css = sheetText(sheet);
        if (css) adopted += `<style data-captured-document-adopted-stylesheet>${css}</style>`;
      }
    } catch {}

    const html = serialize(document.documentElement);
    const withAdopted = adopted ? html.replace('<head>', `<head>${adopted}`) : html;
    return `<!DOCTYPE html>${withAdopted}`;
  });
}

for (const [name, url] of targets) {
  const page = await context.newPage();
  page.on('response', r => { void saveResponse(r); });
  console.log('capturing', url);
  const main = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(7000);
  await page.evaluate(async () => {
    try { await document.fonts.ready; } catch {}
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);

  if (main) {
    try {
      const raw = await main.body();
      await fs.writeFile(path.join(OUT, 'pages', `${name}.raw.html`), raw);
    } catch {}
  }

  const shadowStats = await page.evaluate(() => {
    let open = 0, capturedClosed = 0;
    for (const el of document.querySelectorAll('*')) {
      if (el.shadowRoot) open++;
      else if (el.__captureShadowRoot) capturedClosed++;
    }
    return { open, capturedClosed };
  });
  console.log(`${name}: shadow roots`, shadowStats);

  await fs.writeFile(
    path.join(OUT, 'pages', `${name}.rendered.html`),
    await serializeRenderedDocument(page),
    'utf8'
  );

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
          await page.evaluate(async () => {
            try { await document.fonts.ready; } catch {}
            window.scrollTo(0, 0);
          });
          await fs.writeFile(path.join(OUT, 'pages', 'viewer.rendered.html'), await serializeRenderedDocument(page), 'utf8');
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
