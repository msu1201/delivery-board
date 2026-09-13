import {chromium} from 'playwright';
import {cp,mkdtemp,mkdir,readFile,rm,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {Source,loadConfig} from '../src/source.js';
import {startServer} from '../src/server.js';
const repo=fileURLToPath(new URL('../',import.meta.url)),out=path.join(repo,'launch/assets');
await mkdir(out,{recursive:true});
const root=await mkdtemp(path.join(os.tmpdir(),'public-board-demo-'));
await cp(path.join(repo,'examples/travel-demo'),root,{recursive:true});
const server=await startServer(new Source(await loadConfig(path.join(root,'config.json'))),0);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:root,size:{width:1440,height:1000}}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url);await page.locator('#minimap svg').waitFor();
 await page.waitForTimeout(2000);await page.locator('#roadmap-overview').click();
 await page.screenshot({path:path.join(out,'demo-overview.png')});await page.waitForTimeout(2000);
 await page.locator('#locate-current').click();await page.screenshot({path:path.join(out,'demo-current.png')});await page.waitForTimeout(2500);
 const firstJourney=await page.locator('#journey-select option').nth(1).getAttribute('value');await page.locator('#journey-select').selectOption(firstJourney);await page.waitForTimeout(2500);
 await page.screenshot({path:path.join(out,'demo-journey.png')});
 await page.locator('#roadmap-overview').click();await page.waitForTimeout(1500);
 await promisify(execFile)(process.execPath,[path.join(repo,'scripts/evolve-demo.js'),root]);
 await page.waitForFunction(()=>document.getElementById('current-tasks').textContent.includes('REORDER'),{},{timeout:12000});
 await page.locator('#locate-current').click();await page.waitForTimeout(2500);
 await page.screenshot({path:path.join(out,'demo-evolved.png')});
 const video=page.video();await context.close();await rename(await video.path(),path.join(out,'demo-evolution.webm'));
 if(errors.length)throw Error(errors.join('\n'));
 const social=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
 const cards=[['01','AI 一直在写代码，<br>项目走到哪了？','一张图看懂当前工作、依赖与完成情况','demo-overview.png'],['02','现在做什么，<br>为什么先做它？','蓝色定位当前任务 · 沿连线追踪前置与后续','demo-current.png'],['03','任务完成了，<br>闭环真的通过了吗？','任务数量、验证、验收和交付分别展示','demo-journey.png'],['04','计划改了，<br>看板也跟着变。','保存记录 → 自动读取 → 新任务与依赖出现','demo-evolved.png']];
 for(const [number,title,subtitle,file] of cards){
  const data=(await readFile(path.join(out,file))).toString('base64');
  await social.setContent(`<html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef3f6;color:#173f42;font-family:-apple-system,'PingFang SC',sans-serif;padding:72px}.brand{font-size:26px;letter-spacing:3px}.number{float:right;color:#7c96a0}h1{font-size:65px;line-height:1.3;margin:70px 0 28px;letter-spacing:-2px}p{font-size:29px;color:#56747b;line-height:1.7}.frame{margin-top:45px;padding:10px;background:white;border:1px solid #c9d9dd;border-radius:16px;box-shadow:0 14px 40px #16394515}img{width:100%;display:block;border-radius:8px}.foot{font-size:22px;margin-top:36px;color:#617d84}.pill{display:inline-block;padding:12px 20px;border-radius:8px;background:#dfece8;margin-right:10px;font-size:22px}</style><div class="brand">DELIVERY BOARD <span class="number">${number} / 04</span></div><h1>${title}</h1><p>${subtitle}</p><div><span class="pill">本地运行</span><span class="pill">只读看板</span><span class="pill">项目记录持续演进</span></div><div class="frame"><img src="data:image/png;base64,${data}"></div><p class="foot">演示使用完全虚构的 Wayfarer 旅行项目<br>不连接真实项目 · 不包含真实业务数据</p></html>`);
  await social.screenshot({path:path.join(out,`xiaohongshu-${number}.png`)});
 }
 console.log('Captured fictional screenshots, evolution video and four social cards.');
} finally {await browser.close();await server.close();await rm(root,{recursive:true,force:true});}
