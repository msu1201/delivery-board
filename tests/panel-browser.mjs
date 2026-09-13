import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {Source,loadConfig} from '../src/source.js';
import {startServer} from '../src/server.js';
const server=await startServer(new Source(await loadConfig('examples/synthetic/config.json')),0);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(5000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const select=async()=>{await page.locator('#search').fill('INGEST');await page.locator('#search').press('Enter');};
 await page.goto(server.url);await page.locator('#minimap svg').waitFor();await select();
 const handle=page.getByRole('separator',{name:'调整详情栏宽度'});await handle.waitFor();
 const old=await page.locator('#detail').boundingBox(),h=await handle.boundingBox();
 await page.mouse.move(h.x+h.width/2,h.y+90);await page.mouse.down();await page.mouse.move(h.x-210,h.y+90,{steps:10});await page.mouse.up();
 const wide=await page.locator('#detail').boundingBox();assert.ok(wide.width>old.width+200);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();await page.locator('#minimap svg').waitFor();await select();
 assert.ok(Math.abs((await page.locator('#detail').boundingBox()).width-wide.width)<2);
 await handle.focus();await page.keyboard.press('ArrowLeft');assert.ok((await page.locator('#detail').boundingBox()).width>wide.width);
 await page.setViewportSize({width:900,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await handle.isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Resizable detail panel browser acceptance passed');
} finally {await browser.close();await server.close();}
