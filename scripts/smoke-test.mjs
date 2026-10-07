import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)), site=path.join(root,'_site');
const fixture=path.join(root,'files/physics/_smoke-资料.pdf');
const artifacts=path.join(root,'artifacts');
let browser,server;
if(await fs.access(fixture).then(()=>true,()=>false))throw new Error('Smoke fixture path already exists; refusing to overwrite.');
function build(){execFileSync(process.execPath,[path.join(root,'scripts/build-site.mjs')],{cwd:root,stdio:'pipe'});}
try{
  await fs.mkdir(path.dirname(fixture),{recursive:true});await fs.copyFile(path.join(root,'files/wlsa-sample.pdf'),fixture);build();
  const context={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'assets/data.js'),'utf8'),context);
  const items=context.window.ARCHIVE_ITEMS, material=items.find(i=>i.file==='files/physics/_smoke-资料.pdf');assert.ok(material?.pdf);
  server=createServer(async(req,res)=>{
    try{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname), file=path.resolve(site,'.'+(name==='/'?'/index.html':name));
      if(!file.startsWith(path.resolve(site)+path.sep))throw new Error('Outside site');
      const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.pdf':'application/pdf','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
    }catch{res.statusCode=404;res.end('Not found');}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1638,height:1000},acceptDownloads:true});
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.main-heading.homepage-heading').innerText(),'Explore review guides, notes, and study materials');
  const geometry=await page.evaluate(()=>({heading:document.querySelector('.main-heading').getBoundingClientRect().toJSON(),search:document.querySelector('#home-search-form').getBoundingClientRect().toJSON(),hero:document.querySelector('.hero-slider').getBoundingClientRect().toJSON()}));
  assert.equal(geometry.heading.y,228);assert.equal(geometry.search.x,171);assert.equal(geometry.search.y,314);assert.equal(geometry.search.height,92);assert.equal(geometry.hero.y,390);
  // Check rendered text and destinations inside all captured shadow roots.
  const legacy=await page.evaluate(()=>{
    const text=[],links=[];function visit(root){for(const el of root.querySelectorAll('*')){if(!['STYLE','SCRIPT'].includes(el.tagName)){for(const n of el.childNodes)if(n.nodeType===3)text.push(n.textContent);for(const a of ['href','link','action'])if(el.hasAttribute(a))links.push(el.getAttribute(a));}if(el.shadowRoot)visit(el.shadowRoot);}}visit(document);return{text:text.join(' '),links};
  });assert.doesNotMatch(legacy.text,/JSTOR|ITHAKA|Artstor/);assert.ok(!legacy.links.some(u=>/jstor\.org|ithaka\.org|\/login|\/register/.test(u)));
  await page.locator('.hero-slider__next-button').click();assert.equal(await page.locator('.hero-slider__label--pagination').innerText(),'Image 2 of 5');assert.doesNotMatch(await page.locator('#caption').innerText(),/JSTOR|Artstor/);
  await page.locator('.hero-slider__previous-button').click();
  await page.locator('.thematic-slider__next-button').click();assert.equal(await page.locator('.glide__slide--thematic.glide__slide--active').getAttribute('data-slide-index'),'2');
  await page.locator('.thematic-slider__previous-button').click();
  await page.locator('#materialScope').click();await page.getByRole('option',{name:'Review Guide',exact:true}).click();
  await page.locator('.query-builder-input-group input').fill('电磁学');
  await page.locator('.query-builder-input-group input').press('Enter');await page.waitForURL('**/search.html?*');
  assert.equal(new URL(page.url()).searchParams.get('q'),'电磁学');assert.equal(new URL(page.url()).searchParams.get('type'),'Review Guide');assert.ok(await page.locator('.result-item').count()>0);
  await page.goto(base+'/search.html?subject=Physics&type=Course+Notes&sort=title');
  assert.equal(await page.locator('input[name=subject][value=Physics]').isChecked(),true);
  assert.equal(await page.locator('input[name=type][value="Course Notes"]').isChecked(),true);await page.reload();
  assert.equal(await page.locator('#sortSelect').inputValue(),'title');await page.locator('#clearFilters').click();
  assert.equal(await page.locator('.result-item').count(),items.length);
  await page.locator('#searchInput').fill('电磁学 impossiblekeyword');await page.locator('#searchForm button').click();assert.equal(await page.locator('.result-item').count(),0);
  await page.goto(base+'/search.html?available=1&q='+encodeURIComponent('smoke 资料'));
  assert.equal(await page.locator('.result-item').count(),1);
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download PDF'}).click()]);assert.equal(await download.failure(),null);
  await page.goto(base+'/item.html?id='+material.id);assert.equal(await page.locator('#itemTitle').innerText(),material.title);
  await page.getByRole('link',{name:'Read online',exact:true}).click();await page.waitForSelector('.pdf-page canvas');
  assert.equal(await page.locator('#pageCount').innerText(),'3');
  await page.locator('#pageInput').fill('2');await page.locator('#pageInput').dispatchEvent('change');
  await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();await page.waitForFunction(()=>document.querySelector('#zoomLabel').textContent==='133%');
  await page.locator('#searchToggle').click();await page.locator('#documentSearch').fill('archive');await page.waitForFunction(()=>/\d+ \/ \d+|No matches/.test(document.querySelector('#searchStatus').textContent));
  await page.goto(base+'/item.html?id=missing-id');assert.equal(await page.getByRole('heading',{name:'Material not found'}).count(),1);
  await fs.mkdir(artifacts,{recursive:true});
  for(const width of [1638,390]){
    await page.setViewportSize({width,height:1000});await page.goto(base);
    await page.evaluate(async()=>{document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    if(width===390){await page.locator('#mobileMenuToggle').click();assert.equal(await page.locator('#mobileMenu').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#mobileMenu').isVisible(),false);}
    await page.screenshot({path:path.join(artifacts,`home-${width}.png`),fullPage:true});
    for(const suffix of ['/search.html','/item.html?id=physics-em']){await page.goto(base+suffix);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await fs.writeFile(path.join(artifacts,'smoke-test.json'),JSON.stringify({passed:true,geometry,checks:['Original hero/search geometry','No legacy brand/navigation or external runtime requests','Chinese search and material scope','All query terms required','Filter URL round-trip','Actual PDF upload/index/download/read/zoom/search','Missing material','Desktop/mobile layout and mobile menu'],errors,external},null,2));
  console.log('Smoke tests passed: layout, search, filtering, PDF upload/download/reader, and mobile navigation.');
}finally{
  await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());
  await fs.rm(fixture,{force:true});build();
}
