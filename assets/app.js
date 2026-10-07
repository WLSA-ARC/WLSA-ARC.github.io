(() => {
  'use strict';
  const items = window.ARCHIVE_ITEMS || [];
  const courses = window.ARCHIVE_COURSES || [];
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const params = new URLSearchParams(location.search);
  const itemUrl = i => './item.html?id=' + encodeURIComponent(i.id);
  const readerUrl = i => './viewer.html?' + new URLSearchParams({file:i.pdf, title:i.title});
  const size = bytes => bytes < 1024*1024 ? `${Math.ceil(bytes/1024)} KB` : `${(bytes/1024/1024).toFixed(1)} MB`;
  const typeOptions = [...new Set(['Review Guide', 'Course Notes', 'Practice Set', ...items.map(i=>i.type)])];
  const status = i => i.available ? [i.format,i.size ? size(i.size) : ''].filter(Boolean).join(' · ') : 'Awaiting materials';
  function result(i) {
    return `<article class="result-item"><p class="result-meta">${esc(i.type)} · ${esc(status(i))}</p><h2><a href="${itemUrl(i)}">${esc(i.title)}</a></h2><p class="result-source">${esc(i.subject)}${i.author?' · '+esc(i.author):''}</p><p>${esc(i.description)}</p><div class="result-actions"><a href="${itemUrl(i)}">${i.available?'View material':'View collection'}</a>${i.pdf?`<a href="${esc(readerUrl(i))}">Read online</a>`:''}${i.available?`<a href="${esc(i.href)}" download>Download ${esc(i.format)}</a>`:''}</div></article>`;
  }
  function initNavigation() {
    const toggle = $('#mobileMenuToggle'); if (!toggle) return;
    const menu = document.createElement('nav'); menu.className='arc-mobile-menu'; menu.id='mobileMenu'; menu.hidden=true;
    menu.innerHTML='<a href="./search.html">Browse materials</a><a href="./search.html#filters">All subjects</a>';
    $('#headerMountPoint').append(menu); toggle.setAttribute('aria-controls',menu.id);
    const setExpanded = value => { toggle.setAttribute('aria-expanded',String(value)); toggle.shadowRoot?.querySelector('button')?.setAttribute('aria-expanded',String(value)); };
    toggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;setExpanded(!menu.hidden);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;setExpanded(false);}});
  }
  function initHome() {
    const form = $('#home-search-form'), group = $('.query-builder-input-group');
    const input = group.shadowRoot?.querySelector('input') || $('input',group);
    const scope = $('#materialScope'), button = scope.shadowRoot?.querySelector('button') || scope;
    const menu = document.createElement('div'); menu.className='scope-menu'; menu.id='scopeMenu'; menu.hidden=true; menu.setAttribute('role','listbox'); menu.setAttribute('aria-label','Material type');
    menu.innerHTML=['All Materials',...typeOptions].map((t,index)=>`<button type="button" role="option" aria-selected="${index===0}" data-value="${index===0?'':esc(t)}">${esc(t)}</button>`).join('');
    $('.search-input-wrapper').append(menu); button.setAttribute('aria-controls',menu.id); button.setAttribute('aria-haspopup','listbox');
    const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');};
    scope.addEventListener('click',()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)$('button[aria-selected=true]',menu).focus();});
    menu.addEventListener('click',event=>{
      const option=event.target.closest('button'); if(!option)return;
      $('#submittedType').value=option.dataset.value;
      [...scope.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove()); scope.append(document.createTextNode(option.textContent));
      $$('button',menu).forEach(b=>b.setAttribute('aria-selected',String(b===option))); close(); button.focus();
    });
    menu.addEventListener('keydown',event=>{
      const options=$$('button',menu), current=options.indexOf(document.activeElement);
      if(event.key==='Escape'){close();button.focus();}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();options[(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();}
    });
    document.addEventListener('click',event=>{if(!event.composedPath().includes(scope)&&!menu.contains(event.target))close();});
    function search(event) {
      event?.preventDefault(); const p=new URLSearchParams(); const q=input?.value.trim()||''; if(q)p.set('q',q);
      if($('#submittedType').value)p.set('type',$('#submittedType').value);
      location.href='./search.html'+(p.size?'?'+p:'');
    }
    form.addEventListener('submit',search); input?.addEventListener('keydown',event=>{if(event.key==='Enter')search(event);});
    $('[name=search-button]')?.addEventListener('click',search);
    initCarousel($('.hero-slider'),'.glide__slide--hero',1); initCarousel($('.thematic-slider'),'.glide__slide--thematic',0);
  }
  function initCarousel(container, slideSelector, fixedCount) {
    if(!container)return;
    const slides=$$(slideSelector,container), track=$('.glide__slides',container);
    const previous=$('[data-glide-dir="<"]',container), next=$('[data-glide-dir=">"]',container);
    let index=0, count=1, step=0;
    function render() {
      track.style.transform=`translate3d(${-index*step}px,0,0)`;
      slides.forEach((slide,n)=>slide.classList.toggle('glide__slide--active',n===index));
      if(fixedCount){const current=slides[index];$('#caption').textContent=current.dataset.caption.replace(/Artstor: /g,'');$('#caption-link').textContent=current.dataset.collection.replace(/^Open: /,'').replace('Artstor: ','');$('#copyright').textContent=current.dataset.copyright||'';$('.hero-slider__label--pagination').textContent=`Image ${index+1} of ${slides.length}`;}
    }
    function resize() {
      const width=$('.glide__track',container).clientWidth;
      count=fixedCount||(width<550?2:width<900?3:5);
      const gap=fixedCount?0:32; const slideWidth=(width-gap*(count-1))/count; step=slideWidth+gap;
      track.style.width=`${step*slides.length}px`;
      slides.forEach(slide=>{slide.style.width=`${slideWidth}px`;slide.style.margin='0';slide.style.marginRight=gap+'px';});
      index=Math.min(index,Math.max(0,slides.length-count)); render();
    }
    previous?.addEventListener('click',()=>{index=index>0?index-1:Math.max(0,slides.length-count);render();});
    next?.addEventListener('click',()=>{index=index<slides.length-count?index+1:0;render();});
    new ResizeObserver(resize).observe(container); resize();
  }
  function score(item,q) {
    const terms=q.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean), title=item.title.toLocaleLowerCase();
    const hay=[item.title,item.subject,item.author,item.description,item.type,item.source,...(item.keywords||[]),...(item.topics||[])].join(' ').toLocaleLowerCase();
    if(!terms.every(t=>hay.includes(t)))return 0;
    return terms.reduce((n,t)=>n+(title.includes(t)?5:1),1);
  }
  function initSearch() {
    const input=$('#searchInput'); input.value=params.get('q')||params.get('Query')||'';
    const subjects=[...new Set([...courses.map(c=>c.subject),...items.map(i=>i.subject)])].sort();
    $('#subjectFilters').innerHTML=subjects.map(s=>`<label><input type="checkbox" name="subject" value="${esc(s)}" ${params.getAll('subject').includes(s)?'checked':''}> ${esc(s)}</label>`).join('');
    $('#typeFilters').innerHTML=typeOptions.map(t=>`<label><input type="checkbox" name="type" value="${esc(t)}" ${params.getAll('type').includes(t)?'checked':''}> ${esc(t)}</label>`).join('');
    $('#availableOnly').checked=params.get('available')==='1';
    if(['relevance','title','newest'].includes(params.get('sort')))$('#sortSelect').value=params.get('sort');
    function render() {
      const q=input.value.trim(), selectedSubjects=$$('input[name=subject]:checked').map(x=>x.value), types=$$('input[name=type]:checked').map(x=>x.value);
      const available=$('#availableOnly').checked, sort=$('#sortSelect').value;
      const rows=items.map(i=>({...i,_score:score(i,q)})).filter(i=>i._score>0&&(!selectedSubjects.length||selectedSubjects.includes(i.subject))&&(!types.length||types.includes(i.type))&&(!available||i.available));
      rows.sort((a,b)=>sort==='newest'?(b.updated||'').localeCompare(a.updated||'')||a.title.localeCompare(b.title):sort==='title'?a.title.localeCompare(b.title):b._score-a._score||Number(b.available)-Number(a.available)||a.title.localeCompare(b.title));
      const ready=rows.filter(i=>i.available).length;
      $('#resultsCount').textContent=`${rows.length} ${rows.length===1?'result':'results'} · ${ready} available ${ready===1?'file':'files'}`;
      $('#resultsTitle').textContent=q?`Results for “${q}”`:selectedSubjects.length===1?selectedSubjects[0]:'Browse study materials';
      $('#activeFilters').innerHTML=[...selectedSubjects,...types,...(available?['Available files']:[])].map(t=>`<span>${esc(t)}</span>`).join('');
      $('#resultsList').innerHTML=rows.length?rows.map(result).join(''):'<div class="empty-state"><h2>No materials found</h2><p>Try another keyword or clear the filters. Some collections are still awaiting uploads.</p></div>';
      const p=new URLSearchParams(); if(q)p.set('q',q); selectedSubjects.forEach(v=>p.append('subject',v));types.forEach(v=>p.append('type',v));if(available)p.set('available','1');if(sort!=='relevance')p.set('sort',sort);
      history.replaceState(null,'','./search.html'+(p.size?'?'+p:'')+location.hash);
    }
    $('#searchForm').addEventListener('submit',event=>{event.preventDefault();render();});
    $$('input[type=checkbox],#sortSelect').forEach(el=>el.addEventListener('change',render));
    $('#clearFilters').addEventListener('click',()=>{$$('input[type=checkbox]').forEach(x=>x.checked=false);render();});render();
  }
  function initItem() {
    const id=params.get('id'), course=courses.find(i=>i.id===id), item=items.find(i=>i.id===id)||course;
    if(!item){$('.item-page').innerHTML='<div class="empty-state"><h1>Material not found</h1><p>The requested material is not in this archive.</p><a href="./search.html">Browse materials</a></div>';document.title='Material not found · WLSA ARC';return;}
    document.title=item.title+' · WLSA ARC'; const subjectUrl='./search.html?'+new URLSearchParams({subject:item.subject});
    $('#crumbSubject').textContent=item.subject; $('#crumbSubject').href=subjectUrl;
    $('#itemTitle').textContent=item.title; $('#itemType').textContent=course?'Course collection':item.type;
    $('#itemByline').textContent=item.author||'';$('#itemSource').textContent=course?'WLSA ARC course collection':item.source;
    $('#itemAbstract').textContent=item.description||'Study material shared in the WLSA ARC archive.';
    $('#itemSubjectLink').textContent=item.subject; $('#itemSubjectLink').href=subjectUrl;
    const related=items.filter(i=>i.available&&i.course===(course?.id||item.course));
    $('#relatedSection').hidden=!course;
    $('#relatedMaterials').innerHTML=related.length?related.map(result).join(''):'<p>No materials have been uploaded to this collection yet.</p>';
    const topics=course?.topics||item.topics||[];
    $('#topicSection').hidden=!topics.length;$('#itemTopics').innerHTML=topics.map(t=>`<li>${esc(t)}</li>`).join('');
    const available=item.available||related.length>0;
    $('#accessText').textContent=course?(related.length?`${related.length} ${related.length===1?'file is':'files are'} available in this collection.`:'Awaiting materials. This collection currently contains a topic outline; review files have not been uploaded.'):'Available to read or download without an account.';
    const metadata=[['Subject',item.subject],['Collection',course?'Course collection':item.source],...(!course?[['Type',item.type],['Format',item.format],['File size',size(item.size)],...(item.author?[['Author',item.author]]:[]),...(item.updated?[['Updated',item.updated]]:[])]:[['Available files',related.length]])];
    $('#itemMetadata').innerHTML=metadata.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    let actions='';
    if(item.pdf){const reader=readerUrl(item);actions+=`<a class="primary-btn" href="${esc(reader)}">Read online</a>`;$('#previewSection').hidden=false;$('#previewFrame').src=reader+'&embedded=1';}
    if(item.available){if(['HTML','HTM','TXT','MD'].includes(item.format))actions+=`<a class="primary-btn" href="${esc(item.href)}">Open material</a>`;actions+=`<a class="outline-btn" href="${esc(item.href)}" download>Download ${esc(item.format)}</a>`;}
    if(course&&available)actions+='<a class="outline-btn" href="#relatedSection">Browse collection files</a>';
    if(!available){actions='<span class="availability-note">Awaiting materials</span>';$('#sideAccess').innerHTML='<a href="https://github.com/WLSA-ARC/WLSA-ARC.github.io/blob/main/CONTRIBUTING.md">Contribute materials</a>';}
    $('#itemActions').innerHTML=actions;
  }
  initNavigation();
  if(document.body.dataset.page==='home')initHome();
  if(document.body.dataset.page==='search')initSearch();
  if(document.body.dataset.page==='item')initItem();
})();
