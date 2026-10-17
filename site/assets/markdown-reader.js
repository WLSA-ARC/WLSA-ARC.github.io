(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const id=new URLSearchParams(location.search).get('id');
  const item=(window.ARCHIVE_ITEMS||[]).find(row=>row.available&&row.id===id);
  const content=$('#markdownContent');
  function placeholder(message){const p=document.createElement('p');p.className='markdown-placeholder';p.textContent=message;content.replaceChildren(p);}
  if(!item){$('#markdownTitle').textContent='Material not found';document.title='Material not found · WLSA ARC';placeholder('The requested material is not in this archive.');return;}
  $('#markdownTitle').textContent=item.title;document.title=item.title+' · WLSA ARC';
  const course=(window.ARCHIVE_COURSES||[]).find(row=>row.id===item.course);
  if(course){$('#markdownCourse').before(document.createTextNode('/'));$('#markdownCourse').textContent=course.title;$('#markdownCourse').href='./item.html?id='+encodeURIComponent(course.id);$('#markdownCourse').hidden=false;}
  $('#markdownDownload').href=item.href;$('#markdownDownload').textContent='Download '+item.format;$('#markdownDownload').hidden=false;
  if(item.pdf){$('#markdownOriginal').href='./viewer.html?'+new URLSearchParams({file:item.pdf,title:item.title});$('#markdownOriginal').hidden=false;}
  if(!item.markdown){placeholder('Content coming soon.');return;}
  async function render(){
    const source=new URL(item.markdown,location.href);
    if(source.origin!==location.origin||!source.pathname.startsWith(new URL('./uploads/',location.href).pathname))throw Error('Invalid Markdown source.');
    const response=await fetch(source,{cache:'no-cache'});if(!response.ok)throw Error('Could not load Markdown content.');
    const text=await response.text();if(!text.trim()){placeholder('Content coming soon.');return;}
    const parser=window.markdownit({html:false,linkify:false,typographer:false});
    const template=document.createElement('template');template.innerHTML=parser.render(text);
    for(const el of template.content.querySelectorAll('a[href],img[src]')){
      const attr=el.tagName==='IMG'?'src':'href',value=el.getAttribute(attr);
      if(value.startsWith('#'))continue;
      const url=new URL(value,source),allowed=el.tagName==='IMG'?['http:','https:']:['http:','https:','mailto:','tel:'];
      if(!allowed.includes(url.protocol)){el.removeAttribute(attr);continue;}
      el.setAttribute(attr,url.href);if(el.tagName==='IMG'){el.loading='lazy';el.decoding='async';}
    }
    const slugs=new Map();
    for(const heading of template.content.querySelectorAll('h1,h2,h3,h4,h5,h6')){
      const slug=heading.textContent.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^\p{L}\p{N}_-]/gu,'')||'section';
      const count=slugs.get(slug)||0;slugs.set(slug,count+1);heading.id=slug+(count?'-'+count:'');
    }
    content.replaceChildren(template.content);
  }
  render().catch(()=>placeholder('Content is temporarily unavailable. Please read or download the original file.'));
})();
