// Local review state, independent of refresh timestamps and source writes.
const canonical=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
const pick=n=>Object.fromEntries(Object.entries(n).filter(([key])=>key!=='recorded'));
const validMap=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(n=>n&&typeof n==='object'&&typeof n.id==='string');
const map=rows=>Object.fromEntries(rows.map(n=>[n.id,pick(n)]));
export class ReviewState {
 constructor(storage,project){
  this.storage=storage;this.key=`delivery-board.review.v1:${project}`;this.persistent=true;this.base=null;
  try { const value=JSON.parse(storage.getItem(this.key)||'null');if(value?.version===1&&validMap(value.nodes)&&value.records&&typeof value.records==='object'&&!Array.isArray(value.records)&&Object.values(value.records).every(v=>typeof v==='string')&&validMap(value.groups)&&validMap(value.journeys)&&typeof value.at==='string')this.base=value; } catch {}
 }
 save(){try{this.storage.setItem(this.key,JSON.stringify(this.base));this.persistent=true;}catch{this.persistent=false;}}
 observe(graph){if(!this.base)this.markAll(graph);return this;}
 markAll(g){this.base={version:1,at:new Date().toISOString(),nodes:map(g.nodes),groups:map(g.groups||[]),journeys:map(g.journeys||[]),records:Object.fromEntries((g.workLog||[]).map(e=>[e.id,canonical(e)]))};this.save();}
 unread(e){const old=this.base&&Object.hasOwn(this.base.records,e.id)?this.base.records[e.id]:undefined;return old===undefined?'new':old!==canonical(e)?'updated':null;}
 markRecord(e){this.base.records[e.id]=canonical(e);this.save();}
 changes(g){
  if(!this.base)return [];
  const result=[];
  for(const [collection,rows] of [['nodes',g.nodes],['groups',g.groups||[]],['journeys',g.journeys||[]]]){
   const old=this.base[collection],now=map(rows);
   for(const id of new Set([...Object.keys(old),...Object.keys(now)])){
    const before=Object.hasOwn(old,id)?old[id]:undefined,after=Object.hasOwn(now,id)?now[id]:undefined;
    if(canonical(before)===canonical(after))continue;
    const fields=before&&after?[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>canonical(before[k])!==canonical(after[k])):[];
    result.push({id,collection,kind:!before?'added':!after?'removed':'updated',before,after,fields});
   }
  }
  return result;
 }
}
