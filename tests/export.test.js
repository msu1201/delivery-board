import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdtemp,symlink,rm,access} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),exec=promisify(execFile);
test('public export refuses repository children including parent symlink aliases',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'export-guard-'));
 try{await symlink(root,path.join(temp,'alias'));
 for(const dest of [path.join(root,'not-a-release'),path.join(temp,'alias','not-a-release')]) await assert.rejects(exec(process.execPath,[path.join(root,'scripts/export-release.mjs'),dest]),/outside the working repository/);
 await assert.rejects(access(path.join(root,'not-a-release')));
 }finally{await rm(temp,{recursive:true,force:true});}
});
