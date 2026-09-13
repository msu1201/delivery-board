import { satisfied, hasOwnBlocker } from './model.js';
export const progressStyles = {
 active:{label:'进行中',fill:'#eaf2ff',border:'#2864ae'},
 complete:{label:'已完成',fill:'#e4f3e9',border:'#34805a'},
 partial:{label:'部分完成',fill:'#f0e8fa',border:'#8656b5'},
 waiting:{label:'待人类验收',fill:'#fff1dc',border:'#b37a22'},
 blocked:{label:'受阻',fill:'#fbe9e5',border:'#b45242'},
 pending:{label:'待开始',fill:'#ffffff',border:'#a8b4bb'},
 unknown:{label:'状态未知',fill:'#edf0f3',border:'#87939e'},
};
export function summarizeProgress(nodes) {
 const total=nodes.length,completed=nodes.filter(satisfied).length,
 active=nodes.filter(n=>n.status==='in_progress').length,
 waiting=nodes.filter(n=>n.status==='awaiting_human').length,
 blocked=nodes.filter(n=>n.status!=='awaiting_human'&&hasOwnBlocker(n)).length,
 unknown=nodes.filter(n=>n.status==='unknown').length;
 const partial=completed>0||nodes.some(n=>n.status==='verified'||n.localVerification==='verified');
 const state=active?'active':blocked?'blocked':waiting?'waiting':total&&completed===total?'complete':partial?'partial':!total||unknown?'unknown':'pending';
 return {total,completed,active,waiting,blocked,unknown,state,...progressStyles[state]};
}
export function journeyProgress(graph, journey) {
 const nodes=journey.itemIds.map(id=>graph.nodes.find(n=>n.id===id)).filter(Boolean);
 const progress=summarizeProgress(nodes), activeNodes=nodes.filter(n=>n.status==='in_progress');
 const stages=[journey.localVerification?.status==='passed',journey.acceptanceReview?.status==='accepted',journey.delivery?.status==='delivered'];
 let state='unknown',label='闭环状态未知';
 if(stages[2]) {state='complete';label='已交付';}
 else if(stages[1]) {state='waiting';label=journey.delivery?'待交付':'已验收·交付未知';}
 else if(stages[0]) {state='waiting';label='验证通过·待验收';}
 else if(activeNodes.length) {state='active';label='关联环节进行中';}
 else if(journey.localVerification?.status==='partial') {state='partial';label='部分验证';}
 else if(journey.localVerification?.status==='not_assessed') {state='pending';label='尚未验证';}
 const icons={active:'🟦',complete:'🟩',partial:'🟪',waiting:'🟧',blocked:'🟥',pending:'⬜',unknown:'◻'};
 return {...progress,...progressStyles[state],state,label,icon:icons[state],activeNodes,stages,stageCompleted:stages.filter(Boolean).length};
}
