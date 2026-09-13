// Documentation capture only. Translate the fictional demo and UI copy in an
// isolated browser; do not alter the app, source records, statuses or layout.
import {chromium} from 'playwright';
import {readFile,mkdtemp,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Source,loadConfig} from '../src/source.js';
import {startServer} from '../src/server.js';
const chinese=process.argv.includes('--zh-CN');
const repo=fileURLToPath(new URL('../',import.meta.url));
const pairs = [
['“分组”卡片汇总当前视图中的直接任务，点击展开具体任务；这不是自动推断的一级／二级产品架构。已完成 X/Y 表示 Y 项中有 X 项满足本项完成标准，不表示正在做第 X 项。技术／文档任务以技术验证通过计入，其他任务以验收通过计入；不等于合并交付。里程碑未展开的范围不纳入推测。颜色优先显示进行中、受阻或待验收，完成数仍独立显示。','Expand groups to see their tasks. X/Y counts completed tasks, not execution order. Technical and documentation tasks count when verified; product tasks count when accepted. Delivery is recorded separately.'],
['选择一个闭环，逐项查看独立验收。关联任务通过不代表闭环通过。','Choose a journey to review its acceptance records.'],
['刷新读取本地记录，不查询远端 CI。结构合法不证明工作完成。','Refresh reads local records. Remote CI is not queried.'],
['可缩放的项目依赖图。键盘用户可使用下方节点列表查看相同依赖和详情。','Zoomable dependency graph. The task list also supports keyboard navigation.'],
['左右拖动调整详情宽度；双击恢复默认，也可使用方向键','Drag to resize; double-click to reset. Arrow keys also work.'],
['选择一个节点，查看用户闭环、前置条件和解除阻塞的下一步。','Select a task to see its journey, prerequisites and next steps.'],
['整体依赖小地图，蓝色是当前任务；框线是当前视野。点击或使用方向键移动视野','Project minimap. Blue marks current work. Click to move the viewport.'],
['观察时间：以节点记录为准，缺失即未知','observation time: see task records'],
['最近检查点（来源记录）：','Latest checkpoint: '],
['当前没有记录进行中的任务','No active task recorded'],
['此进行中任务仍有阻塞记录，请查看节点详情。','This task has recorded blockers. See its details.'],
['里程碑范围未展开时不计算百分比','Unspecified scope has no percentage'],
['基础与数据','Foundation'],['发现目的地','Discovery'],['编排行程','Itinerary'],['出发准备','Departure'],['同行分享','Sharing'],
['全部工作','All work'],['行程编排路径','Planning path'],['阻塞与待评审','Blocked / review'],
['确定周末旅行范围','Define trip scope'],['载入示例目的地','Load destinations'],['保存行程草稿','Save trip drafts'],['搜索心仪目的地','Search destinations'],['收藏候选地点','Save favorites'],['把地点排进每日行程','Build daily itinerary'],['拖动调整游览顺序','Reorder stops'],['接入路线估算样例','Route estimates'],['显示地点间交通时间','Show travel times'],['确认行程编排体验','Review itinerary'],['生成出发前清单','Departure checklist'],['缓存离线行程样例','Cache sample trip'],['离线查看旅行安排','View trip offline'],['生成只读分享链接','Create share link'],['评审分享隐私提示','Review share privacy'],['同行者查看分享行程','View shared trip'],['完成周末行程编排','Trip planning ready'],['阅读出发前指南','Read departure guide'],
['从目的地到每日行程','Plan a daily itinerary'],['使用出发前清单','Use a departure checklist'],['与同行者分享只读行程','Share a read-only trip'],
['闭环状态未知','Journey unknown'],['已验收·交付未知','Accepted; delivery unknown'],['验证通过·待验收','Verified; awaiting acceptance'],['关联环节进行中','Work in progress'],['部分验证','Partly verified'],['尚未验证','Not verified'],['待交付','Awaiting delivery'],['已交付','Delivered'],
['来源文件有未提交更改','Source has uncommitted changes'],['分支未知','Branch unknown'],['来源版本未知','Version unknown'],['版本未知','Unknown'],['来源文件','Source'],
['正在读取已保存记录','Reading saved records'],['已读取保存的记录','Saved records loaded'],['正在读取任务状态…','Reading task status…'],['正在读取项目…','Loading project…'],['尚无有效记录，当前任务未知。','No valid records yet.'],['依据已保存记录','From saved records'],
['选择节点查看依赖与证据。','Select a task to view dependencies and evidence.'],
['来源与读取边界','Sources'],['任务关系详情','Task relationships'],['记录中进行的任务','Active tasks'],['用户闭环','User journeys'],['闭环验收记录未知','Journey acceptance unknown'],['闭环未记录','Journey not recorded'],['当前工作','Current work'],['整体路线','Roadmap'],['定位当前','Locate current'],['工作范围','Workspaces'],['视图与分组','Views and groups'],['全部任务','All tasks'],['展开全部','Expand all'],['折叠全部','Collapse all'],['所属分组','Group'],['关联闭环','Journeys'],['里程碑范围','Milestone scope'],['依赖通往','Leads to'],['未满足前置','Unmet prerequisites'],['直接后续','Next tasks'],
['箭头表示前置依赖','Arrows show dependencies'],['验收与交付','Acceptance and delivery'],['合并交付','Delivery'],['项目依赖','Project dependencies'],['依赖图工作区','Dependency graph'],['查找节点','Find a task'],['搜索 ID、用户结果…','Search tasks or outcomes…'],['退出依赖聚焦','Clear focus'],['收起详情','Hide details'],['缩小','Zoom out'],['放大','Zoom in'],['查看全图','Fit graph'],['依赖总览','Dependencies'],['载入中','Loading'],['分组层级与完成数说明','How progress is counted'],['整体位置','Map'],['点击移动视野','Click to navigate'],['拖动画布平移','Drag to pan'],['点击分组展开','Click groups to expand'],['点击节点查看证据','Click tasks for evidence'],['未成功读取','Not yet read'],['节点查找与键盘操作','Task list and keyboard navigation'],['调整详情栏宽度','Resize details'],['节点详情','Task details'],['从结果追溯到证据','Follow the evidence'],['用户结果','User outcome'],['依赖与证据','Dependencies and evidence'],['关闭证据','Close evidence'],['关闭','Close'],['证据','Evidence'],
['个外部前置','external prerequisites'],['条真实前置','dependencies'],['个节点','tasks'],['条依赖','dependencies'],['仅当前视图范围','This view only'],['外部前置','External prerequisite'],['深色双边框：选中','Double border: selected'],['待人类验收','Awaiting review'],['等待人类验收','Awaiting review'],['状态未知','Unknown'],['部分完成','Partial'],['已完成','Complete'],['待验收','Review'],['待开始','Pending'],['技术已验证','Verified'],['已验收','Accepted'],['正在进行','Active'],['项进行中','active'],['进行中','Active'],['待规划','Planned'],['已记录 ready','Ready'],['受阻','Blocked'],['未知','Unknown'],['分组','Group'],['环节','tasks'],['验收','Acceptance'],
['自动刷新 · 5秒','Auto-refresh · 5s'],['刷新记录','Refresh'],['成功读取','Read at'],['读取开始：','Read started: '],['读取完成：','Read finished: '],['只读根目录：','Source root: '],['来源时间（mtime）：','Source modified: '],['范围：','scope: '],['远端 CI 未重新查询','Remote CI not queried'],['远端 CI','Remote CI'],['检查点未记录','No checkpoint recorded'],['无记录','None recorded'],['只读','Read-only'],['无','None'],
];
const replacements=pairs.sort((a,b)=>b[0].length-a[0].length);
function translate(text){for(const [a,b] of replacements)text=text.split(a).join(b);return text;}
const root=await mkdtemp(path.join(os.tmpdir(),'board-english-capture-'));
await cp(path.join(repo,'examples/travel-demo'),root,{recursive:true});
const server=await startServer(new Source(await loadConfig(path.join(root,'config.json'))),0);
let browser;
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const response=await route.fetch(); const url=new URL(route.request().url());
  if(['/', '/app.js','/graph.js','/progress.js','/client-state.js','/api/snapshot'].includes(url.pathname)){
   let body=await response.text();
   body=chinese ? body.replaceAll("Wayfarer · Fictional travel planner", "Wayfarer · 虚构旅行规划项目") : translate(body);
   if(!chinese && url.pathname==='/')body=body.replace('lang="zh-CN"','lang="en"');
   if(!chinese && url.pathname==='/app.js')body=body.replace('toLocaleString("zh-CN"','toLocaleString("en-GB"');
   await route.fulfill({response,body});
  }else await route.fulfill({response});
 });
 await page.goto(server.url);await page.locator('#minimap svg').waitFor();
 await page.locator('#roadmap-overview').click();
 await page.waitForTimeout(600);
 const remaining=await page.evaluate(()=>document.body.innerText.match(/[^\n]*[\u4e00-\u9fff][^\n]*/g));
 if(!chinese && remaining)throw Error('Untranslated visible text:\n'+remaining.join('\n'));
 const labels=await page.evaluate(()=>document.getElementById('cy')._cyreg.cy.nodes().map(n=>n.data('label')).join('\n'));
 if(!chinese && /[\u4e00-\u9fff]/.test(labels))throw Error('Untranslated graph label: '+labels);
 if(errors.length)throw Error(errors.join('\n'));
 await page.screenshot({path:path.join(repo,`launch/assets/demo-overview-${chinese?'zh-CN':'en'}.png`)});
 console.log(chinese ? 'Captured Chinese README image.' : 'Captured English README image; visible text and canvas labels contain no Chinese.');
}finally{await browser?.close();await server.close();await rm(root,{recursive:true,force:true});}
