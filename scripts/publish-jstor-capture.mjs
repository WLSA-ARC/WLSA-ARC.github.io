import fs from 'node:fs/promises';

const ROOT = 'jstor-original';
const manifest = JSON.parse(await fs.readFile(`${ROOT}/manifest.json`, 'utf8'));
const resources = manifest.resources || [];

function replaceAllLiteral(text, from, to) {
  if (!from || from === to) return text;
  return text.split(from).join(to);
}

function rewriteAssets(html) {
  // Point every captured production asset at the exact mirrored response in this repo.
  for (const r of resources) {
    if (!r.url || !r.file) continue;
    const local = `/jstor-original/${r.file}`;
    const protocolRelative = r.url.replace(/^https?:/, '');
    html = replaceAllLiteral(html, r.url, local);
    html = replaceAllLiteral(html, protocolRelative, local);
    html = replaceAllLiteral(html, r.url.replaceAll('&', '&amp;'), local.replaceAll('&', '&amp;'));
    html = replaceAllLiteral(html, protocolRelative.replaceAll('&', '&amp;'), local.replaceAll('&', '&amp;'));

    try {
      const u = new URL(r.url);
      if (u.hostname === 'www.jstor.org') {
        const rel = `${u.pathname}${u.search}`;
        const relHtml = `${u.pathname}${u.search.replaceAll('&', '&amp;')}`;
        html = replaceAllLiteral(html, `\"${rel}\"`, `\"${local}\"`);
        html = replaceAllLiteral(html, `'${rel}'`, `'${local}'`);
        html = replaceAllLiteral(html, `\"${relHtml}\"`, `\"${local}\"`);
        html = replaceAllLiteral(html, `'${relHtml}'`, `'${local}'`);
      }
    } catch {}
  }

  // Root-relative asset references that were fetched without a query string.
  for (const r of resources) {
    try {
      const u = new URL(r.url);
      if (u.hostname !== 'www.jstor.org' || u.search) continue;
      const local = `/jstor-original/${r.file}`;
      html = replaceAllLiteral(html, `src=\"${u.pathname}\"`, `src=\"${local}\"`);
      html = replaceAllLiteral(html, `href=\"${u.pathname}\"`, `href=\"${local}\"`);
    } catch {}
  }

  return html;
}

function redirectUnmirroredNavigation(html) {
  // We have not mirrored stable/item/viewer pages yet. Keep ordinary JSTOR navigation
  // functional by sending normal anchor/form navigation to the licensed live site.
  html = html.replace(/(<a\b[^>]*\bhref=[\"'])\/(?!\/)([^\"']*)([\"'])/gi, (m, pre, rest, quote) => {
    if (!rest || rest.startsWith('jstor-original/')) return m;
    return `${pre}https://www.jstor.org/${rest}${quote}`;
  });
  html = html.replace(/(<form\b[^>]*\baction=[\"'])\/(?!\/)([^\"']*)([\"'])/gi, (m, pre, rest, quote) => {
    return `${pre}https://www.jstor.org/${rest}${quote}`;
  });
  return html;
}

function makeHomepageStaticCompatible(html) {
  // The captured HTML is already JSTOR's post-render DOM. Re-running JSTOR's MFEs on
  // wlsa-arc.github.io makes them call JSTOR-only same-origin POST endpoints and exposes
  // modal/dropdown fallback light DOM when Shadow DOM hydration fails. Preserve the
  // captured production DOM/CSS and stop those runtimes from mutating it on this origin.
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  html = html.replace(/\s+onload=[\"']validateElementsPresent\(\);?[\"']/gi, '');

  const css = '<link rel="stylesheet" href="/assets/jstor-static-compat.css">';
  const js = '<script src="/assets/jstor-static-compat.js" defer></script>';

  if (html.includes('</head>')) html = html.replace('</head>', `${css}\n</head>`);
  else html = `${css}\n${html}`;

  if (html.includes('</body>')) html = html.replace('</body>', `${js}\n</body>`);
  else html += `\n${js}`;

  return html;
}

async function publish(source, destination, { staticHomepage = false } = {}) {
  let html = await fs.readFile(source, 'utf8');
  html = rewriteAssets(html);
  html = redirectUnmirroredNavigation(html);
  if (staticHomepage) html = makeHomepageStaticCompatible(html);
  await fs.writeFile(destination, html, 'utf8');
  console.log(`published ${source} -> ${destination}`);
}

await publish(`${ROOT}/pages/home.rendered.html`, 'index.html', { staticHomepage: true });
await publish(`${ROOT}/pages/search.rendered.html`, 'search.html');
