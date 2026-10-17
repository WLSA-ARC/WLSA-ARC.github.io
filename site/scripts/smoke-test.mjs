import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import {checkSearchControls} from '../tests/search-controls.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)), site=path.join(root,'_site');
const fixture=path.resolve(root,'../uploads/_smoke-资料.pdf');
const artifacts=path.join(root,'artifacts');
let browser,server;
if(await fs.access(fixture).then(()=>true,()=>false))throw new Error('Smoke fixture path already exists; refusing to overwrite.');
function build(){execFileSync(process.execPath,[path.join(root,'scripts/build-site.mjs')],{cwd:root,stdio:'pipe'});}
try{
  await fs.mkdir(path.dirname(fixture),{recursive:true});
  execFileSync(process.env.PYTHON||'python',[path.join(root,'scripts/pdf_metadata.py'),'write',path.join(root,'tests/fixtures/reader.pdf'),'--output',fixture,'--course','physics-em','--title','smoke 资料','--type','review-guide','--keywords','电磁学','Gauss'],{encoding:'utf8'});
  build();
  const context={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'assets/data.js'),'utf8'),context);
  const items=context.window.ARCHIVE_ITEMS, material=items.find(i=>i.file==='uploads/_smoke-资料.pdf');assert.ok(material?.pdf);assert.equal(material.subject,'Physics');assert.equal(material.course,'physics-em');
  server=createServer(async(req,res)=>{
    try{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname), file=name==='/_test/original.pdf'?path.join(root,'tests/fixtures/reader.pdf'):path.resolve(site,'.'+(name==='/'?'/index.html':name));
      if(name!=='/_test/original.pdf'&&!file.startsWith(path.resolve(site)+path.sep))throw new Error('Outside site');
      const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.pdf':'application/pdf','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
    }catch{res.statusCode=404;res.end('Not found');}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  // Simulate the first paint before the application script is available.
  const initial=await browser.newPage();
  await initial.route('**/assets/app.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  for(const width of [1638,390]){
    await initial.setViewportSize({width,height:1000});await initial.goto(base);await initial.evaluate(()=>document.fonts.ready);
    const dimensions=await initial.evaluate(()=>({
      cover:document.querySelector('.arc-cover-section').getBoundingClientRect().toJSON(),
      imagePosition:getComputedStyle(document.querySelector('.arc-cover')).objectPosition,
      grid:document.querySelector('.course-grid').clientWidth,
      card:document.querySelector('.course-card').getBoundingClientRect().width,
      scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight
    }));
    assert.ok(Math.abs(dimensions.cover.height-width*1082/3860)<1);
    assert.equal(dimensions.imagePosition,'50% 0%');
    const count=width<=700?2:3,gap=width<=700?20:32;
    assert.ok(Math.abs(dimensions.card-(dimensions.grid-gap*(count-1))/count)<1);
    assert.equal(dimensions.scrollWidth,width);
    await fs.mkdir(artifacts,{recursive:true});await initial.screenshot({path:path.join(artifacts,`initial-paint-${width}.png`)});
  }
  await initial.close();
  const page=await browser.newPage({viewport:{width:1638,height:1000},acceptDownloads:true});
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1.arc-home-heading').innerText(),'Start reviewing here.');
  const titleFont=await page.locator('h1.arc-home-heading').evaluate(el=>({family:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight}));
  assert.equal(titleFont.family,'"Iowan Old Style", Baskerville, "Songti SC", STSong, Georgia, serif');assert.equal(titleFont.weight,'700');
  const geometry=await page.evaluate(()=>({heading:document.querySelector('.main-heading').getBoundingClientRect().toJSON(),search:document.querySelector('#home-search-form').getBoundingClientRect().toJSON(),hero:document.querySelector('.hero-slider').getBoundingClientRect().toJSON()}));
  assert.equal(await page.locator('.mfe-header__top').count(),0);
  assert.equal(geometry.heading.y,179);assert.equal(geometry.search.x,171);assert.equal(geometry.search.y,geometry.heading.y+geometry.heading.height+32);
  assert.ok(Math.abs(geometry.hero.y-(geometry.search.y+geometry.search.height-16))<1);
  assert.equal(await page.getByText('Advanced Search',{exact:true}).count(),0);
  assert.equal(await page.locator('.thematic-container > p').count(),0);
  const config=JSON.parse(await fs.readFile(path.join(root,'config/catalog.json'),'utf8'));
  assert.equal(await page.locator('h1#courseHeading').innerText(),'Course');
  assert.equal(await page.locator('.thematic-slider,.course-grid img').count(),0);
  const homeCourses=await page.locator('.course-title').allTextContents();
  assert.deepEqual(homeCourses,config.courses.map(c=>c.title));assert.equal(homeCourses.length,config.courses.length);
  assert.match(await page.locator('.course-title').first().evaluate(el=>getComputedStyle(el).fontFamily),/GT America Standard/);
  for(const subject of ['mathematics','chinese']){
    await page.locator(`#courseNav button[data-course-subject="${subject}"]`).click();
    assert.equal(await page.locator('.course-card:visible').count(),config.courses.filter(c=>c.subjectCode===subject).length);
    assert.equal(new URL(page.url()).searchParams.get('subject'),subject);
    await page.reload();assert.equal(await page.locator(`#courseNav button[data-course-subject="${subject}"]`).getAttribute('aria-pressed'),'true');
  }
  await page.getByRole('button',{name:'All',exact:true}).click();
  assert.equal(await page.locator('.course-card:visible').count(),config.courses.length);
  const avatar=await page.locator('.course-avatar').first().evaluate(el=>({ratio:el.clientWidth/el.clientHeight,radius:getComputedStyle(el).borderRadius,weight:getComputedStyle(el).fontWeight}));
  assert.ok(Math.abs(avatar.ratio-4/3)<.01);assert.equal(avatar.radius,'6px');assert.equal(avatar.weight,'700');
  assert.ok(!homeCourses.includes('Multivariable Calculus Review')&&!homeCourses.includes('SAT Review'));
  assert.equal(await page.getByRole('link',{name:'About',exact:true}).count(),0);
  await page.goto(base+'/about.html');
  assert.equal(await page.locator('main').innerText(),'复习资料存储仓库');
  await page.locator('.mfe-header__arc-logo').click();await page.waitForURL(base+'/');
  assert.ok(Math.abs(geometry.hero.height-1638*1082/3860)<1);
  const rendered=await page.evaluate(async tagged=>{
    const lib=await import('/assets/pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='/assets/pdfjs/pdf.worker.min.mjs';
    const result=[];
    for(const file of ['/_test/original.pdf',tagged]){
      const pdf=await lib.getDocument(file).promise,images=[];
      for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),view=p.getViewport({scale:1});const canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;await p.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;images.push(canvas.toDataURL());}
      result.push(images);await pdf.destroy();
    }
    return result;
  },material.pdf);assert.deepEqual(rendered[0],rendered[1]);
  // Check rendered text and destinations inside all captured shadow roots.
  const legacy=await page.evaluate(()=>{
    const text=[],links=[];function visit(root){for(const el of root.querySelectorAll('*')){if(!['STYLE','SCRIPT'].includes(el.tagName)){for(const n of el.childNodes)if(n.nodeType===3)text.push(n.textContent);for(const a of ['href','link','action'])if(el.hasAttribute(a))links.push(el.getAttribute(a));}if(el.shadowRoot)visit(el.shadowRoot);}}visit(document);return{text:text.join(' '),links};
  });assert.doesNotMatch(legacy.text,/JSTOR|ITHAKA|Artstor/);assert.ok(!legacy.links.some(u=>/jstor\.org|ithaka\.org|\/login|\/register/.test(u)));
  assert.equal(await page.locator('.arc-cover').getAttribute('src'),'./assets/design/study-cover-hd.webp');
  const coverPixels=await page.locator('.arc-cover').evaluate(async img=>{await img.decode();return[img.naturalWidth,img.naturalHeight];});assert.deepEqual(coverPixels,[3712,2048]);
  assert.equal(await page.locator('.course-avatar').first().innerText(),'CL');
  assert.equal(await page.locator('.course-avatar').nth(config.courses.findIndex(c=>c.id==='ap-calculus-bc')).innerText(),'BC');
  await page.locator('.course-card').first().click();await page.waitForURL('**/item.html?id=g11-chinese-literature');
  await page.locator('.mfe-header__arc-logo').click();await page.waitForURL(base+'/');
  await page.locator('#materialScope').click();await page.getByRole('option',{name:'Review Guide',exact:true}).click();
  await page.locator('.query-builder-input-group input').fill('电磁学');
  await page.locator('.query-builder-input-group input').press('Enter');await page.waitForURL('**/search.html?*');
  assert.equal(new URL(page.url()).searchParams.get('q'),'电磁学');assert.equal(new URL(page.url()).searchParams.get('type'),'Review Guide');assert.ok(await page.locator('.result-item').count()>0);
  await page.goto(base+'/search.html?subject=Physics&type=Course+Notes&sort=title');
  assert.equal(await page.locator('.result-item h2').first().evaluate(el=>getComputedStyle(el).fontWeight),'700');
  assert.equal(await page.locator('input[type=search]').count(),1);
  await page.locator('#searchInput').focus();
  assert.equal(await page.locator('#searchInput').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  assert.equal(await page.locator('#searchForm').evaluate(el=>getComputedStyle(el).outlineWidth),'2px');
  assert.equal(await page.locator('input[name=subject][value=Physics]').isChecked(),true);
  assert.equal(await page.locator('input[name=type][value="Course Notes"]').isChecked(),true);await page.reload();
  assert.equal(await page.locator('#sortSelect').inputValue(),'title');await page.locator('#clearFilters').click();
  assert.equal(await page.locator('.result-item').count(),items.length);
  await page.mouse.move(1100,500);await page.mouse.wheel(0,650);await page.waitForFunction(()=>window.scrollY>300);
  const pinned=await page.evaluate(()=>({header:document.querySelector('#headerMountPoint').getBoundingClientRect().bottom,filters:document.querySelector('#filters').getBoundingClientRect().top,search:document.querySelector('#searchForm').getBoundingClientRect().top}));
  assert.ok(Math.abs(pinned.filters-pinned.header-64)<1);assert.ok(Math.abs(pinned.search-pinned.header-64)<1);
  assert.equal(await page.locator('.archive-filters fieldset').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  await page.screenshot({path:path.join(artifacts,'search-fixed-controls.png')});
  await page.locator('#searchInput').fill('电磁学 impossiblekeyword');await page.locator('#searchForm button').click();assert.equal(await page.locator('.result-item').count(),0);
  await page.goto(base+'/search.html?available=1&q='+encodeURIComponent('smoke 资料'));
  assert.equal(await page.locator('.result-item').count(),1);
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download PDF'}).click()]);assert.equal(await download.failure(),null);
  await page.goto(base+'/item.html?id='+material.id);await page.waitForURL('**/item.html?id=physics-em');
  assert.equal(await page.locator('#itemTitle').innerText(),config.courses.find(c=>c.id==='physics-em').title);
  assert.equal(await page.getByRole('link',{name:'View material',exact:true}).count(),0);
  assert.equal(await page.locator('.result-meta,#itemMetadata,.arc-footer').count(),0);
  await page.locator('.result-item').filter({has:page.getByRole('heading',{name:material.title,exact:true})}).getByRole('link',{name:'Read online',exact:true}).click();await page.waitForSelector('.pdf-page canvas');
  await fs.mkdir(artifacts,{recursive:true});await page.locator('.pdf-page canvas').first().screenshot({path:path.join(artifacts,'metadata-body-render.png')});
  assert.equal(await page.locator('#pageCount').innerText(),'3');
  await page.locator('#pageInput').fill('2');await page.locator('#pageInput').dispatchEvent('change');
  await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();await page.waitForFunction(()=>document.querySelector('#zoomLabel').textContent==='133%');
  await page.locator('#searchToggle').click();await page.locator('#documentSearch').fill('archive');await page.waitForFunction(()=>/\d+ \/ \d+|No matches/.test(document.querySelector('#searchStatus').textContent));
  await page.goto(base+'/item.html?id=missing-id');assert.equal(await page.getByRole('heading',{name:'Material not found'}).count(),1);
  // Every BC collection must show the real files, without copying them or changing their grade labels.
  const bcFiles=items.filter(i=>i.available&&i.courses?.includes('ap-calculus-bc'));
  assert.ok(bcFiles.length>0);
  for(const id of ['g10-calculus-bc','g11-calculus-bc','ap-calculus-bc']) {
    await page.goto(base+'/item.html?id='+id);
    assert.equal(await page.locator('#relatedMaterials .result-item').count(),bcFiles.length);
    assert.equal(await page.getByRole('link',{name:'Browse collection files',exact:true}).count(),0);
    assert.deepEqual(await page.locator('.side-card h2').allTextContents(),['Grade','Uploader']);
    assert.match(await page.locator('#courseGrades').innerText(),/G10/);
    assert.equal(await page.locator('#relatedMaterials h2').filter({hasText:'G10 Calculus BC'}).count(),1);
  }
  await page.goto(base+'/search.html?q=BC');
  assert.equal(await page.locator('.result-item').count(),bcFiles.length);
  await checkSearchControls(page,base);
  await fs.mkdir(artifacts,{recursive:true});
  for(const width of [1638,390]){
    await page.setViewportSize({width,height:1000});await page.goto(base);
    await page.evaluate(async()=>{document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.equal(await page.getByRole('link',{name:'About',exact:true}).count(),0);
    const footerGap=await page.evaluate(()=>{
      return document.querySelector('.arc-footer').getBoundingClientRect().top-document.querySelector('.course-grid').getBoundingClientRect().bottom;
    });assert.ok(footerGap>=48,`Footer gap is ${footerGap}px`);
    await page.evaluate(()=>window.scrollTo(0,600));
    assert.equal(await page.locator('#headerMountPoint').evaluate(el=>el.getBoundingClientRect().top),0);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(artifacts,`home-${width}.png`),fullPage:true});
    for(const suffix of ['/search.html','/item.html?id=physics-em']){await page.goto(base+suffix);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await fs.writeFile(path.join(artifacts,'smoke-test.json'),JSON.stringify({passed:true,geometry,checks:['Top text strip removed, other layout preserved','No legacy brand/navigation or external runtime requests','Embedded metadata recognizes flat uploads','PDF page rendering unchanged after tagging','Chinese search and material scope','All query terms required','Filter URL round-trip','Actual PDF upload/index/download/read/zoom/search','Missing material','Desktop/mobile layout and mobile menu'],errors,external},null,2));
  console.log('Smoke tests passed: layout, fixed controls, search, filtering, and PDF upload/download/reader.');
}finally{
  await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());
  await fs.rm(fixture,{force:true});build();
}
