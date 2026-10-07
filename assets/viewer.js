import * as pdfjsLib from './pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const requested = params.get('file');
const embedded = params.get('embedded') === '1';
let pdf, scale=1.2, currentPage=1, generation=0, pageObserver, visibleObserver, thumbObserver, searchGeneration=0;
let searchPages=[], searchIndex=-1;
const pagesEl=$('#pages'), scrollEl=$('#pdfScroll'), tasks=new Map();
if(embedded)document.body.classList.add('viewer-embedded');
function status(text){$('#readerStatus').textContent=text;$('#readerStatus').hidden=false;}
function updateZoom(){$('#zoomLabel').textContent=`${Math.round(scale/1.2*100)}%`;}
function goToPage(n){if(!pdf)return;n=Math.max(1,Math.min(pdf.numPages,+n||1));$(`.pdf-page[data-page="${n}"]`)?.scrollIntoView({behavior:'auto',block:'start'});}
async function renderCanvas(wrap,num,thumbnail,version){
  const key=(thumbnail?'thumb-':'page-')+num;
  if(wrap.querySelector('canvas')||tasks.has(key))return;
  const page=await pdf.getPage(num);if(version!==generation)return;
  const viewport=page.getViewport({scale:thumbnail?.2:scale});
  const canvas=document.createElement('canvas'), dpr=thumbnail?1:Math.min(devicePixelRatio||1,2);
  canvas.width=Math.ceil(viewport.width*dpr);canvas.height=Math.ceil(viewport.height*dpr);
  canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  wrap.prepend(canvas);
  const task=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null});tasks.set(key,task);
  try{await task.promise;}catch(error){if(error.name!=='RenderingCancelledException'){console.error(error);status('Could not render this page. Download the PDF to read it.');}}
  finally{if(tasks.get(key)===task)tasks.delete(key);}
}
function discardCanvas(wrap){const num=wrap.dataset.page;tasks.get('page-'+num)?.cancel();const canvas=wrap.querySelector('canvas');if(canvas){canvas.width=0;canvas.height=0;canvas.remove();}}
async function layoutPages(){
  const version=++generation;pageObserver?.disconnect();visibleObserver?.disconnect();thumbObserver?.disconnect();tasks.forEach(task=>task.cancel());tasks.clear();
  pagesEl.replaceChildren();$('#thumbList').replaceChildren();
  pageObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){if(entry.isIntersecting)renderCanvas(entry.target,+entry.target.dataset.page,false,version);else discardCanvas(entry.target);}
  },{root:scrollEl,rootMargin:'1000px 0px'});
  visibleObserver=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(visible){currentPage=+visible.target.dataset.page;$('#pageInput').value=currentPage;$$('.thumb').forEach(t=>t.classList.toggle('active',+t.dataset.page===currentPage));}
  },{root:scrollEl,threshold:[.2,.5,.8]});
  thumbObserver=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(e=>renderCanvas(e.target,+e.target.dataset.page,true,version));},{root:$('#thumbSidebar'),rootMargin:'200px'});
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);if(version!==generation)return;
    const view=page.getViewport({scale});const wrap=document.createElement('section');wrap.className='pdf-page';wrap.dataset.page=n;
    wrap.style.width=view.width+'px';wrap.style.height=view.height+'px';wrap.setAttribute('aria-label','Page '+n);pagesEl.append(wrap);pageObserver.observe(wrap);visibleObserver.observe(wrap);
    const thumb=document.createElement('button');thumb.className='thumb';thumb.dataset.page=n;thumb.setAttribute('aria-label','Go to page '+n);thumb.style.minHeight=(page.getViewport({scale:.2}).height+28)+'px';
    const label=document.createElement('span');label.textContent=n;thumb.append(label);$('#thumbList').append(thumb);thumb.onclick=()=>goToPage(n);thumbObserver.observe(thumb);
  }
  updateZoom();$('#readerStatus').hidden=true;
}
let resizeTimer;
function rerender(value){if(!pdf)return;scale=Math.max(.5,Math.min(3,value));clearTimeout(resizeTimer);resizeTimer=setTimeout(async()=>{const page=currentPage;status('Rendering…');await layoutPages();goToPage(page);},100);}
async function searchDocument(term){
  if(!pdf)return;term=term.trim().toLowerCase();const version=++searchGeneration;searchPages=[];searchIndex=-1;$$('.pdf-page').forEach(p=>p.classList.remove('search-hit'));
  if(!term){$('#searchStatus').textContent='';return;}$('#searchStatus').textContent='Searching…';
  const matches=[];
  for(let n=1;n<=pdf.numPages;n++){const text=await(await pdf.getPage(n)).getTextContent();if(version!==searchGeneration)return;const joined=text.items.map(x=>x.str).join(' ').toLowerCase();if(joined.includes(term))matches.push(n);}
  searchPages=matches;$('#searchStatus').textContent=matches.length?`${matches.length} matching pages`:'No matches';if(matches.length){searchIndex=0;showSearchHit();}
}
function showSearchHit(){if(!searchPages.length)return;const page=searchPages[searchIndex];$$('.pdf-page').forEach(el=>el.classList.toggle('search-hit',+el.dataset.page===page));goToPage(page);$('#searchStatus').textContent=`${searchIndex+1} / ${searchPages.length}`;}
$('#toggleThumbs').onclick=()=>{const closed=$('#thumbSidebar').classList.toggle('closed');$('#toggleThumbs').setAttribute('aria-expanded',String(!closed));};
$('#zoomIn').onclick=()=>rerender(scale+.2);$('#zoomOut').onclick=()=>rerender(scale-.2);
$('#fitWidth').onclick=async()=>{if(!pdf)return;const view=(await pdf.getPage(currentPage)).getViewport({scale:1});rerender((scrollEl.clientWidth-60)/view.width);};
$('#pageInput').addEventListener('change',event=>goToPage(event.target.value));
$('#searchToggle').onclick=()=>{const open=$('#viewerSearch').classList.toggle('open');$('#searchToggle').setAttribute('aria-expanded',String(open));if(open)$('#documentSearch').focus();};
let searchTimer;$('#documentSearch').addEventListener('input',event=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchDocument(event.target.value),250);});
$('#searchNext').onclick=()=>{if(searchPages.length){searchIndex=(searchIndex+1)%searchPages.length;showSearchHit();}};
$('#searchPrev').onclick=()=>{if(searchPages.length){searchIndex=(searchIndex-1+searchPages.length)%searchPages.length;showSearchHit();}};
$('#fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status('Fullscreen is unavailable in this browser.');}};
try{
  if(!requested)throw new Error('Select a PDF from the study archive to open the reader.');
  const file=new URL(requested,location.href), base=new URL('./files/',location.href);
  if(file.origin!==base.origin||!file.pathname.startsWith(base.pathname)||!file.pathname.toLowerCase().endsWith('.pdf'))throw new Error('Choose a PDF stored in this archive’s files folder.');
  const title=params.get('title')||decodeURIComponent(file.pathname.split('/').pop());$('#viewerTitle').textContent=title;document.title=title+' · WLSA ARC';$('#downloadBtn').href=file.href;
  pdf=await pdfjsLib.getDocument(file.href).promise;$('#pageCount').textContent=pdf.numPages;$('#pageInput').max=pdf.numPages;
  status('Rendering document…');await layoutPages();
}catch(error){console.error(error);status(error.message?.startsWith('Select')||error.message?.startsWith('Choose')?error.message:'Could not open this PDF. Return to the archive or download the original file.');}
