import test from 'node:test';
import assert from 'node:assert/strict';
import { dependencyLayout } from '../public/layout.js';
const entity=id=>({id});
test('dependency layout follows branches and convergence with no overlapping cards',()=>{
 const entities=['a','b','c','d','alone'].map(entity), edges=[['a','b'],['a','c'],['b','d'],['c','d']].map(([source,target])=>({source,target}));
 const p=dependencyLayout(entities,edges);
 for(const e of edges) assert.ok(p.get(e.source).x<p.get(e.target).x);
 for(let i=0;i<entities.length;i++) for(let j=i+1;j<entities.length;j++) {const a=p.get(entities[i].id),b=p.get(entities[j].id);assert.ok(Math.abs(a.x-b.x)>=240 || Math.abs(a.y-b.y)>=120);}
 assert.deepEqual(p,dependencyLayout(entities,edges));
});
test('collapsed-group cycles terminate and retain distinct positions without mutation',()=>{
 const entities=['a','b','c'].map(entity), edges=[['a','b'],['b','a'],['b','c']].map(([source,target])=>({source,target}));
 const before=JSON.stringify({entities,edges}),p=dependencyLayout(entities,edges);
 assert.equal(p.size,3);assert.notDeepEqual(p.get('a'),p.get('b'));assert.ok(p.get('b').x<p.get('c').x);
 assert.equal(JSON.stringify({entities,edges}),before);
 assert.equal(dependencyLayout([],[]).size,0);
});
