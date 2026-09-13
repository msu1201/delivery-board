import test from 'node:test';
import assert from 'node:assert/strict';
import {ReviewState} from '../public/seen-changes.js';
const graph=()=>({nodes:[{id:'A',title:'A',status:'planned',dependsOn:[]}],workLog:[],groups:[],journeys:[]});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('first view establishes baseline; refresh and reopening retain unseen changes until acknowledged',()=>{
 const store=memory(),g=graph(),s=new ReviewState(store,'p');s.observe(g);assert.equal(s.changes(g).length,0);
 g.nodes[0].status='verified';s.observe(g);assert.equal(s.changes(g).length,1);
 const reopened=new ReviewState(store,'p');reopened.observe(g);assert.equal(reopened.changes(g).length,1);
 assert.equal(new ReviewState(store,'other').observe(g).changes(g).length,0);
 reopened.markAll(g);assert.equal(reopened.changes(g).length,0);
});
test('records distinguish new and updated, preserve historical removals and edge changes',()=>{
 const g=graph(),s=new ReviewState(memory(),'p');s.observe(g);
 g.workLog=[{id:'r',title:'Round',result:'first'}];assert.equal(s.unread(g.workLog[0]),'new');s.markRecord(g.workLog[0]);assert.equal(s.unread(g.workLog[0]),null);
 g.workLog[0].result='second';assert.equal(s.unread(g.workLog[0]),'updated');
 g.nodes.push({id:'B',title:'B',dependsOn:['A']});assert.ok(s.changes(g).some(x=>x.kind==='added'));
 s.markAll(g);g.nodes=g.nodes.filter(n=>n.id!=='A');g.nodes[0].dependsOn=[];
 assert.ok(s.changes(g).some(x=>x.kind==='removed'&&x.id==='A'));
 assert.ok(s.changes(g).some(x=>x.id==='B'&&x.fields.includes('dependsOn')));
});
test('unavailable or corrupt storage does not break rendering and reports persistence failure',()=>{
 const s=new ReviewState({getItem:()=>'{bad',setItem:()=>{throw Error('quota')}},'p');s.observe(graph());assert.equal(s.persistent,false);assert.equal(s.changes(graph()).length,0);
});
test('valid IDs matching object prototype names are treated as new records',()=>{
 const s=new ReviewState(memory(),'p'),g=graph();s.observe(g);
 g.nodes.push({id:'constructor',title:'Constructor',dependsOn:[]});assert.ok(s.changes(g).some(c=>c.id==='constructor'&&c.kind==='added'));
 assert.equal(s.unread({id:'toString',title:'Work'}),'new');
});
