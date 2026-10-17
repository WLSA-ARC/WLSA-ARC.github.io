import fs from 'node:fs/promises';
import path from 'node:path';

const list = (await fs.readFile('scripts/authorized-home-assets.txt', 'utf8'))
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36',
  'referer': 'https://www.jstor.org/'
};

for (const raw of list) {
  const u = new URL(raw);
  const res = await fetch(raw, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${raw}`);
  const data = Buffer.from(await res.arrayBuffer());
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index';
  const dest = path.join('jstor-original', 'hosts', u.hostname, p.replace(/^\/+/, ''));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data);
  console.log(`${res.status} ${data.length} ${raw} -> ${dest}`);
}

await fs.writeFile(
  'jstor-original/authorized-har-import.json',
  JSON.stringify({ importedAt: new Date().toISOString(), source: 'authorized Chrome HAR', count: list.length, urls: list }, null, 2)
);
