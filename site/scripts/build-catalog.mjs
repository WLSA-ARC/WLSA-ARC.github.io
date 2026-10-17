import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const site = fileURLToPath(new URL('../', import.meta.url));
const uploadRoot = path.resolve(site, '../uploads');
const config = JSON.parse(await fs.readFile(path.join(site, 'config/catalog.json'), 'utf8'));
const courseAliases = config.courseAliases || {};
if (typeof courseAliases !== 'object' || Array.isArray(courseAliases)) throw new Error('courseAliases must be an object.');
for (const [alias, target] of Object.entries(courseAliases)) {
  if (!alias || config.courses.some(c=>c.id===alias) || !config.courses.some(c=>c.id===target)) throw new Error(`Invalid course alias: ${alias}`);
}
// A shared curriculum can have several grade/exam entries without duplicating PDFs.
const sharedCourses = new Map();
for (const group of config.sharedCourseGroups || []) {
  if (!Array.isArray(group) || group.length < 2 || new Set(group).size !== group.length) throw new Error('Invalid shared course group.');
  for (const id of group) {
    if (!config.courses.some(c=>c.id===id) || sharedCourses.has(id)) throw new Error(`Unknown or repeated shared course: ${id}`);
    sharedCourses.set(id, group);
  }
  if (new Set(group.map(id=>config.courses.find(c=>c.id===id).subjectCode)).size!==1) throw new Error('Shared courses must belong to the same subject.');
}
const extensions = new Set(['.pdf', '.html', '.htm', '.md', '.txt', '.docx', '.pptx', '.xlsx', '.zip']);
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.sort((a,b)=>a.name.localeCompare(b.name)).map(async entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() ? [full] : [];
  }));
  return nested.flat();
}
const fullPaths = await walk(uploadRoot);
const stem = file => file.slice(0,-path.extname(file).length);
const companionMarkdown = new Map(fullPaths.filter(file=>path.extname(file).toLowerCase()==='.md').map(file=>[stem(file),file]));
const sourceStems = new Set(fullPaths.filter(file=>extensions.has(path.extname(file).toLowerCase())&&path.extname(file).toLowerCase()!=='.md').map(stem));
const pdfMetadata = new Map();
if (fullPaths.some(p=>path.extname(p).toLowerCase()==='.pdf')) {
  const output = execFileSync(process.env.PYTHON || 'python', [path.join(site,'scripts/pdf_metadata.py'),'scan',uploadRoot], {encoding:'utf8',maxBuffer:16*1024*1024});
  for(const row of JSON.parse(output)) {
    if(row.warning)console.warn(`${row.relative}: ${row.warning}`);
    pdfMetadata.set(row.relative,row);
  }
}
const items = [], ids = new Set();
for (const full of fullPaths) {
  const relative = path.relative(uploadRoot, full).split(path.sep).join('/');
  const file = 'uploads/' + relative, ext = path.extname(file).toLowerCase();
  if (!extensions.has(ext) || path.basename(file).toLowerCase()==='readme.md') continue;
  if(ext==='.md'&&sourceStems.has(stem(full)))continue;
  const pdf = pdfMetadata.get(relative);
  // Embedded ARC records stay authoritative. Untagged originals can be indexed
  // through the registry without rewriting their PDF bytes or existing credits.
  const info = ext==='.pdf'
    ? pdf?.metadata?.id ? pdf.metadata : {...pdf?.metadata,...config.files[file]}
    : config.files[file] || {};
  const course = config.courses.find(c=>c.id===(courseAliases[info.course] || info.course));
  const courseIds = course ? sharedCourses.get(course.id) || [course.id] : [];
  const courseTitles = courseIds.map(id=>config.courses.find(c=>c.id===id).title);
  const subjectCode = info.subject || course?.subjectCode || 'general';
  const typeCode = info.type || 'resource';
  const subject = config.subjects[subjectCode];
  if(!subject)throw new Error(`${file}: unknown subject code ${subjectCode}`);
  if(!config.types[typeCode])throw new Error(`${file}: unknown material type ${typeCode}`);
  if(info.course&&!course)throw new Error(`${file}: unknown course code ${info.course}`);
  if(course&&info.subject&&info.subject!==course.subjectCode)throw new Error(`${file}: subject does not match course ${course.id}`);
  const id = info.id || 'file-' + createHash('sha256').update(file).digest('hex').slice(0,16);
  if(ids.has(id)||config.courses.some(c=>c.id===id)||Object.hasOwn(courseAliases,id))throw new Error(`${file}: duplicate/reserved material id ${id}`);
  ids.add(id);
  const stat = await fs.stat(full);
  const href = './' + file.split('/').map(encodeURIComponent).join('/');
  const markdownFile=ext==='.md'?full:companionMarkdown.get(stem(full));
  const markdown=markdownFile?'./uploads/'+path.relative(uploadRoot,markdownFile).split(path.sep).map(encodeURIComponent).join('/'):'';
  items.push({
    id, title: info.title || path.basename(file, ext).replace(/[_-]/g,' ').trim(),
    author:info.author || '', subject, subjectCode, course:course?.id || '', courses:courseIds, courseTitles,
    type:config.types[typeCode], typeCode,
    description:info.description || '', keywords:info.keywords?.length?info.keywords:course?.keywords || [],
    topics:info.topics || [], grade:info.grade || course?.grade || '', examBoard:info.examBoard || course?.examBoard || '', languages:info.languages || [],
    source:course?.title || 'Study materials', format:ext.slice(1).toUpperCase(),
    file, href, markdown, ...(ext==='.pdf'&&pdf?.readable?{pdf:href,pages:pdf.pages}:{}),
    size:stat.size, updated:info.updated || '', available:true,
  });
}
const placeholders=config.courses.filter(c=>!items.some(i=>i.courses.includes(c.id))).map(c=>({
  ...c,type:'Review Guide',source:'Course collection',author:'',available:false,format:''
}));
const data=`// Generated from uploads/ and embedded PDF metadata.\nwindow.ARCHIVE_COURSE_ALIASES = ${JSON.stringify(courseAliases,null,2)};\nwindow.ARCHIVE_COURSES = ${JSON.stringify(config.courses,null,2)};\nwindow.ARCHIVE_ITEMS = ${JSON.stringify([...items,...placeholders],null,2)};\n`;
await fs.writeFile(path.join(site,'assets/data.js'),data);
console.log(`Indexed ${items.length} uploads; ${placeholders.length} collections awaiting uploads.`);
