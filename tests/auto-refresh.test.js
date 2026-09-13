import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoRefresh} from '../public/auto-refresh.js';
test('polling never overlaps, pauses when hidden/disabled and manual requests still work',async()=>{
 let next=null,calls=0,resolve;
 const a=new AutoRefresh(()=>{calls++;return new Promise(r=>resolve=r);},{setTimer:fn=>(next=fn,1),clearTimer:()=>next=null});
 a.start();assert.equal(calls,1);assert.equal(next,null);
 resolve();await Promise.resolve();await Promise.resolve();assert.equal(typeof next,'function');
 a.setVisible(false);assert.equal(next,null);
 a.setVisible(true);assert.equal(calls,2);resolve();await Promise.resolve();await Promise.resolve();
 a.setEnabled(false);assert.equal(next,null);const promise=a.refreshNow();assert.equal(calls,3);resolve();await promise;assert.equal(next,null);
});
