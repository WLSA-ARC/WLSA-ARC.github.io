import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './build-catalog.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const output = path.resolve(root,'_site');
if(path.dirname(output)!==path.resolve(root))throw new Error('Build output must stay inside the repository.');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
// An explicit allowlist keeps source snapshots and maintenance scripts out of Pages.
for(const file of ['index.html','search.html','item.html','viewer.html','404.html','.nojekyll']){
  await fs.copyFile(path.join(root,file),path.join(output,file));
}
await fs.mkdir(path.join(output,'assets'),{recursive:true});
for(const file of ['app.js','data.js','archive.css','site.css','viewer.js','arc-logo.png']){
  await fs.copyFile(path.join(root,'assets',file),path.join(output,'assets',file));
}
for(const dir of ['design','pdfjs'])await fs.cp(path.join(root,'assets',dir),path.join(output,'assets',dir),{recursive:true});
await fs.cp(path.join(root,'files'),path.join(output,'files'),{recursive:true});
await fs.cp(path.join(root,'docs'),path.join(output,'docs'),{recursive:true});
console.log('Built _site/ for GitHub Pages.');
