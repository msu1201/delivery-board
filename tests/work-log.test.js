import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph} from '../src/model.js';
const graph=workLog=>({schemaVersion:1,project:{name:'Test'},groups:[{id:'g',title:'G'}],views:[{id:'all',title:'All',mode:'all'}],nodes:[],workLog});
const entry=()=>({id:'round-1',title:'Review',summary:'Clarify scope',result:'Draft prepared',status:'completed',startedAt:'2026-09-13T01:00:00Z',endedAt:'2026-09-13T02:00:00Z',taskIds:['deleted-task'],previousTaskIds:[],nextTaskIds:['future-task']});
test('work history validates intervals and status while retaining historical task IDs',()=>{
 assert.doesNotThrow(()=>validateGraph(graph([entry()])));
 assert.doesNotThrow(()=>validateGraph(graph([{...entry(),startedAt:null,endedAt:null}])));
 for(const bad of [{endedAt:'2026-09-13T00:00:00Z'},{startedAt:'yesterday'},{startedAt:'2026-02-30T01:00:00Z'},{status:'accepted'},{taskIds:'a'},{title:null},{status:'in_progress'}])assert.throws(()=>validateGraph(graph([{...entry(),...bad}])));
 assert.throws(()=>validateGraph(graph([entry(),entry()])));
 assert.throws(()=>validateGraph(graph({})));
});
test('work history is optional and does not change current graph state',()=>{
 const g=graph(undefined);assert.doesNotThrow(()=>validateGraph(g));
 const history=graph([entry()]);validateGraph(history);assert.equal(history.nodes.length,0);
});
