import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProgress } from '../src/progress.js';
const n=(status,kind='product')=>({status,kind});
test('counts completed work independently from active task position',()=>{
 const s=summarizeProgress([n('accepted'),n('verified','technical'),n('in_progress'),n('planned'),n('planned'),n('planned'),n('planned')]);
 assert.equal(s.completed,2);assert.equal(s.total,7);assert.equal(s.active,1);assert.equal(s.state,'active');
});
test('distinguishes complete partial pending blocked waiting and unknown',()=>{
 for(const [nodes,state] of [[[n('accepted')],'complete'],[[n('accepted'),n('planned')],'partial'],[[n('verified')],'partial'],[[n('planned')],'pending'],[[n('blocked')],'blocked'],[[n('awaiting_human')],'waiting'],[[n('unknown')],'unknown'],[[],'unknown']]) assert.equal(summarizeProgress(nodes).state,state);
 assert.equal(summarizeProgress([n('verified')]).completed,0);
});
test('journey progress never promotes completed linked tasks into accepted or delivered journey',async()=>{
 const {journeyProgress}=await import('../src/progress.js');
 const graph={nodes:[{id:'a',status:'accepted',kind:'product'},{id:'b',status:'in_progress',kind:'product'}]};
 const j={itemIds:['a','b'],recordSource:'explicit',localVerification:{status:'partial'}};
 const p=journeyProgress(graph,j);assert.equal(p.completed,1);assert.equal(p.total,2);assert.equal(p.stageCompleted,0);assert.equal(p.state,'active');
 assert.equal(journeyProgress(graph,{...j,itemIds:['a']}).state,'partial');
 assert.equal(journeyProgress(graph,{...j,recordSource:'narrative',localVerification:null,itemIds:['a']}).state,'unknown');
 assert.equal(journeyProgress(graph,{...j,localVerification:{status:'passed'},acceptanceReview:{status:'accepted'},delivery:{status:'delivered'}}).stageCompleted,3);
});
