const labels={in_progress:'进行中',completed:'本轮完成',blocked:'受阻',unknown:'结果未知'};
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const date=value=>value ? new Date(value).toLocaleString(undefined,{hour12:false}) : '未记录';
export function renderWorkLog(container, graph, selectTask, {unread=()=>null, markRead=()=>{}} = {}) {
 const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
 const entries=[...(graph?.workLog||[])].sort((a,b)=>time(b.startedAt)-time(a.startedAt));
 const heading=make('div',undefined,'history-heading');
 heading.append(make('h2','工作记录',''),make('p',`${entries.length} 轮记录 · 最近开始的在前 · 时间按本地时区显示`));
 container.replaceChildren(heading);
 container.append(make('p','本轮完成表示这次工作已结束，不代表关联任务已经验收或交付。前置和后续按当时记录展示。','history-note'));
 if(!entries.length){const empty=make('div',undefined,'history-empty');empty.append(make('h3','还没有保存工作记录'),make('p','让你的 Agent 在每轮工作开始和结束时保存标题、问题、结果、时间和任务关系。已有记录不足时保留未知，不从刷新时间推算执行历史。'));container.append(empty);return;}
 const list=make('ol',undefined,'history-list');
 for(const entry of entries){
  const card=make('li',undefined,`history-card history-${entry.status}`);
  const top=make('div',undefined,'history-card-heading');top.append(make('h3',entry.title),make('span',labels[entry.status],'history-status'));card.append(top);
  const facts=make('dl');
  for(const [label,value] of [['解决的问题',entry.summary||'未记录'],['达到的效果',entry.result||'未记录'],['执行时间',`${date(entry.startedAt)} → ${entry.endedAt ? date(entry.endedAt) : entry.status==='in_progress'?'进行中（尚未记录结束）':'结束时间未记录'}`]]){const row=make('div');row.append(make('dt',label),make('dd',value));facts.append(row);}
  const detail=make('details',undefined,'history-round-detail');
  const summary=make('summary','展开本轮详情');detail.append(summary,facts);
  const flag=unread(entry),badge=make('span',flag==='new'?'● 未读':flag==='updated'?'● 有更新':'已读','read-badge');top.append(badge);
  card.classList.toggle('history-unread',!!flag);
  detail.addEventListener('toggle',()=>{if(detail.open&&unread(entry)){if(markRead(entry)!==false){badge.textContent='已读';card.classList.remove('history-unread');}}});
  card.append(detail);
  for(const [key,label] of [['taskIds','关联任务'],['previousTaskIds','当时的前置'],['nextTaskIds','当时的后续']]){
   const row=make('div',undefined,'history-links');row.append(make('span',label));
   if(!entry[key].length)row.append(make('span','未记录','history-muted'));
   for(const id of entry[key]){const node=graph.nodes.find(n=>n.id===id);if(node){const b=make('button',`${id} · ${node.title}`);b.addEventListener('click',()=>selectTask(id));row.append(b);}else row.append(make('span',`${id}（当前图中不存在）`,'history-muted'));}
   detail.append(row);
  }
  list.append(card);
 }
 container.append(list);
}
