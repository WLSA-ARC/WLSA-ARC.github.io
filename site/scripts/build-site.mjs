import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import './build-catalog.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const output = path.resolve(root,'_site');
if(path.dirname(output)!==path.resolve(root))throw new Error('Build output must stay inside the repository.');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
// An explicit allowlist keeps source snapshots and maintenance scripts out of Pages.
for(const file of ['index.html','search.html','item.html','viewer.html','markdown.html','about.html','404.html','.nojekyll']){
  await fs.copyFile(path.join(root,file),path.join(output,file));
}
const config=JSON.parse(await fs.readFile(path.join(root,'config/catalog.json'),'utf8'));
const initials={
  'chinese-literature':'CL','calculus-bc':'BC','chemistry':'CH','pre-calculus':'PC',
  'world-history':'WH','us-history':'US','english-literature':'EL','psychology':'PS',
  'macroeconomics':'MA','macro':'MA','biology':'BI','physics-1':'P1','physics-c-m':'CM',
  'physics-em':'EM','english-language':'LA','statistics':'ST','microeconomics':'MI',
  'computer-science-a':'CSA','computer-science-principles':'CSP','anatomy':'AN',
};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const cards=config.courses.map(course=>{
  const code=course.id.replace(/^(g\d+|ap)-/,'');
  const letters=initials[code]||course.title.replace(/^(G\d+|AP)\s+/,'').split(/\s+/).map(word=>word[0]).join('').slice(0,3).toUpperCase();
  return `<li data-course-subject="${escape(course.subjectCode)}"><a class="course-card" href="./item.html?id=${encodeURIComponent(course.id)}"><span class="course-avatar" data-subject="${escape(course.subjectCode)}" aria-hidden="true">${escape(letters)}</span><span class="course-title">${escape(course.title)}</span><span class="course-subject">${escape(course.subject)}</span></a></li>`;
}).join('\n');
const subjectCodes=[...new Set(config.courses.map(course=>course.subjectCode))];
const subjectNav='<button type="button" data-course-subject="" aria-pressed="true">All</button>'+subjectCodes.map(code=>`<button type="button" data-course-subject="${escape(code)}" aria-pressed="false">${escape(config.subjects[code])}</button>`).join('');
const homePath=path.join(output,'index.html'),home=await fs.readFile(homePath,'utf8');
if(!home.includes('<!-- ARC_COURSES -->')||!home.includes('<!-- ARC_COURSE_SUBJECTS -->'))throw new Error('Home course grid placeholder missing.');
await fs.writeFile(homePath,home.replace('<!-- ARC_COURSES -->',cards).replace('<!-- ARC_COURSE_SUBJECTS -->',subjectNav));
await fs.mkdir(path.join(output,'assets'),{recursive:true});
for(const file of ['app.js','data.js','archive.css','site.css','viewer.js','markdown-reader.js','arc-logo.png']){
  await fs.copyFile(path.join(root,'assets',file),path.join(output,'assets',file));
}
for(const dir of ['design','pdfjs'])await fs.cp(path.join(root,'assets',dir),path.join(output,'assets',dir),{recursive:true});
await fs.copyFile(path.join(root,'node_modules/markdown-it/dist/browser/markdown-it.umd.min.js'),path.join(output,'assets/markdown-it.min.js'));
await fs.copyFile(path.join(root,'node_modules/markdown-it/LICENSE'),path.join(output,'assets/markdown-it.LICENSE.txt'));
const uploadRoot=path.resolve(root,'../uploads');
await fs.cp(uploadRoot,path.join(output,'uploads'),{recursive:true});
await fs.cp(path.join(root,'docs'),path.join(output,'docs'),{recursive:true});
// New deployments must not mix cached CSS/JS with the updated page markup.
const versions=new Map();
for(const file of ['app.js','data.js','archive.css','site.css','viewer.js','markdown-reader.js','markdown-it.min.js']){
  const bytes=await fs.readFile(path.join(output,'assets',file));
  versions.set(file,createHash('sha256').update(bytes).digest('hex').slice(0,12));
}
for(const file of ['index.html','search.html','item.html','viewer.html','markdown.html','about.html','404.html']){
  const target=path.join(output,file);let html=await fs.readFile(target,'utf8');
  for(const [asset,version] of versions)html=html.split('./assets/'+asset).join('./assets/'+asset+'?v='+version);
  await fs.writeFile(target,html);
}
console.log('Built _site/ for GitHub Pages.');
