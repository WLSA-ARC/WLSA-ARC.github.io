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
  const typeOptions = ['Review Guide', 'Course Notes'];
  function result(i) {
    const title=i.available?esc(i.title):`<a href="${itemUrl(i)}">${esc(i.title)}</a>`;
    return `<article class="result-item${i.available?' is-material':''}"><h2>${title}</h2><p>${esc(i.description)}</p><div class="result-actions">${!i.available?`<a href="${itemUrl(i)}">View collection</a>`:''}${i.pdf?`<a href="${esc(readerUrl(i))}">Read online</a>`:''}${i.available?`<a href="${esc(i.href)}" download>Download ${esc(i.format)}</a><a href="./markdown.html?id=${encodeURIComponent(i.id)}">View Now</a>`:''}</div></article>`;
  }
  function initHome() {
    const nav=$('#courseNav'), tabs=$$('button',nav), cards=$$('.course-grid>li');
    function selectSubject(subject) {
      if(!tabs.some(tab=>tab.dataset.courseSubject===subject))subject='';
      tabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.courseSubject===subject)));
      cards.forEach(card=>card.hidden=Boolean(subject&&card.dataset.courseSubject!==subject));
    }
    selectSubject(params.get('subject')||'');
    nav.addEventListener('click',event=>{
      const tab=event.target.closest('button');if(!tab)return;
      const subject=tab.dataset.courseSubject;selectSubject(subject);
      const url=new URL(location.href);if(subject)url.searchParams.set('subject',subject);else url.searchParams.delete('subject');
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    });
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
  }
  function score(item,q) {
    const terms=q.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean), title=item.title.toLocaleLowerCase();
    const hay=[item.title,item.subject,item.author,item.description,item.type,item.source,item.grade,item.examBoard,...(item.courseTitles||[]),...(item.languages||[]),...(item.keywords||[]),...(item.topics||[])].join(' ').toLocaleLowerCase();
    if(!terms.every(t=>hay.includes(t)))return 0;
    return terms.reduce((n,t)=>n+(title.includes(t)?5:1),1);
  }
  function initSearch() {
    const filters=$('#filters'), toolbar=$('.archive-search-toolbar');
    const filterToggle=document.createElement('button');
    filterToggle.type='button';filterToggle.className='archive-filter-toggle';filterToggle.textContent='Refine results';
    filterToggle.setAttribute('aria-controls','filters');filterToggle.setAttribute('aria-expanded','false');
    toolbar.append(filterToggle);
    const closeFilters=()=>{filters.classList.remove('is-open');filterToggle.setAttribute('aria-expanded','false');};
    filterToggle.addEventListener('click',()=>{const open=filters.classList.toggle('is-open');filterToggle.setAttribute('aria-expanded',String(open));});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&filters.classList.contains('is-open')){closeFilters();filterToggle.focus();}});
    document.addEventListener('click',event=>{if(!filters.contains(event.target)&&!filterToggle.contains(event.target))closeFilters();});
    const input=$('#searchInput'); input.value=params.get('q')||params.get('Query')||'';
    const subjects=[...new Set([...courses.map(c=>c.subject),...items.map(i=>i.subject)])].sort();
    $('#subjectFilters').innerHTML=subjects.map(s=>`<label><input type="checkbox" name="subject" value="${esc(s)}" ${params.getAll('subject').includes(s)?'checked':''}> ${esc(s)}</label>`).join('');
    const selectedTypes=params.getAll('type').map(t=>({'Practice Set':'Review Guide',Reference:'Course Notes','Study Material':'Course Notes'}[t]||t));
    $('#typeFilters').innerHTML=typeOptions.map(t=>`<label><input type="checkbox" name="type" value="${esc(t)}" ${selectedTypes.includes(t)?'checked':''}> ${esc(t)}</label>`).join('');
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
    const requested=params.get('id');let id=Object.hasOwn(window.ARCHIVE_COURSE_ALIASES||{},requested)?window.ARCHIVE_COURSE_ALIASES[requested]:requested;
    const material=items.find(i=>i.available&&i.id===id);
    if(material){
      if(!material.course){location.replace(material.pdf?readerUrl(material):material.href);return;}
      id=material.course;history.replaceState(null,'',itemUrl({id})+location.hash);
    }
    const course=courses.find(i=>i.id===id);
    if(!course){$('.item-page').innerHTML='<div class="empty-state"><h1>Material not found</h1><p>The requested material is not in this archive.</p><a href="./search.html">Browse materials</a></div>';document.title='Material not found · WLSA ARC';return;}
    document.title=course.title+' · WLSA ARC';
    $('#crumbSubject').textContent=course.subject;$('#crumbSubject').href='./search.html?'+new URLSearchParams({subject:course.subject});
    $('#itemTitle').textContent=course.title;
    $('#itemAbstract').textContent=course.description||'';$('#itemAbstract').closest('.item-section').hidden=!course.description;
    const related=items.filter(i=>i.available&&(i.courses||[i.course]).includes(course.id));
    $('#relatedMaterials').innerHTML=related.length?related.map(result).join(''):'<p>No materials have been uploaded to this collection yet.</p>';
    const topics=course.topics||[];
    $('#topicSection').hidden=!topics.length;$('#itemTopics').innerHTML=topics.map(t=>`<li>${esc(t)}</li>`).join('');
    const grades=[...new Set([course.grade,...related.map(i=>i.grade)].filter(Boolean))];
    const uploaders=[...new Set(related.map(i=>i.author).filter(Boolean))];
    $('#courseGrades').textContent=grades.join(', ')||'Not specified';
    $('#courseUploaders').textContent=uploaders.join(', ')||'Not specified';
  }
  if(document.body.dataset.page==='home')initHome();
  if(document.body.dataset.page==='search')initSearch();
  if(document.body.dataset.page==='item')initItem();
})();
