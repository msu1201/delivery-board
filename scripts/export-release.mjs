#!/usr/bin/env node
import {cp, lstat, mkdir, readdir, readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const requested=process.argv[2] && path.resolve(process.argv[2]);
const dest=requested && path.join(await realpath(path.dirname(requested)),path.basename(requested));
if(!dest || dest===root || dest.startsWith(root+path.sep)) throw Error('Provide a new export directory outside the working repository');
const allowed=['src','public','examples/synthetic','examples/travel-demo','skills/delivery-board','tests','launch','package.json','package-lock.json','README.md','README.zh-CN.md','LICENSE','THIRD-PARTY-NOTICES.md','.gitignore','docs/ADAPTER-CONTRACT.md','docs/WORKFLOW.md','docs/WORKFLOW-TEMPLATE.md','docs/DEPENDENCIES.md','docs/LAUNCHER.md','scripts/evolve-demo.js','scripts/export-release.mjs','scripts/capture-demo.mjs'];
const files=[];
async function inspect(relative){
 const from=path.join(root,relative),s=await lstat(from);
 if(s.isSymbolicLink()) throw Error(`Symlink refused: ${relative}`);
 if(s.isDirectory()){for(const name of (await readdir(from)).sort())await inspect(path.join(relative,name));return;}
 if(!s.isFile())throw Error(`Unsupported file: ${relative}`);
 const data=await readFile(from);
 if(!/\.(png|webm|mp4)$/.test(relative) && !relative.endsWith('export-release.mjs')) {
   const text=data.toString('utf8');
   if(/\/Users\/[a-z0-9_-]+|duo[-]naplan|duo[k]ids|\bDEC-012\b|gh[pousr]_[A-Za-z0-9]{20,}/i.test(text))throw Error(`Private-data pattern in ${relative}`);
 }
 files.push({path:relative.replaceAll(path.sep,'/'),sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length});
}
for(const name of allowed)await inspect(name);
await mkdir(dest); // Refuse any existing destination, including symlinks.
for(const name of allowed)await cp(path.join(root,name),path.join(dest,name),{recursive:true,errorOnExist:true,force:false});
await writeFile(path.join(dest,'RELEASE-MANIFEST.json'),JSON.stringify({version:'0.2.0',exportedAt:new Date().toISOString(),fictionalDemoOnly:true,files},null,2)+'\n');
console.log(`Exported ${files.length} allowlisted files without repository history to ${dest}`);
