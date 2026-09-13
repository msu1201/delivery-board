// Layout uses only projected dependencies. SCCs handle cycles introduced by grouping.
export function dependencyLayout(entities, edges) {
  const ids = entities.map(e => e.id), next = new Map(ids.map(id => [id, []]));
  edges.forEach(e => next.get(e.source)?.push(e.target));
  const index = new Map(), low = new Map(), stack = [], on = new Set(), components = [];
  let serial = 0;
  function visit(id) {
    index.set(id, serial); low.set(id, serial++); stack.push(id); on.add(id);
    for (const to of next.get(id)) {
      if (!index.has(to)) { visit(to); low.set(id, Math.min(low.get(id), low.get(to))); }
      else if (on.has(to)) low.set(id, Math.min(low.get(id), index.get(to)));
    }
    if (low.get(id) === index.get(id)) {
      const members = []; let top;
      do { top = stack.pop(); on.delete(top); members.push(top); } while (top !== id);
      components.push(members.reverse());
    }
  }
  ids.forEach(id => { if (!index.has(id)) visit(id); });
  const component = new Map(); components.forEach((c,i) => c.forEach(id => component.set(id,i)));
  const before = components.map(() => new Set());
  edges.forEach(e => { const a=component.get(e.source), b=component.get(e.target); if(a!==b) before[b].add(a); });
  const ranks = new Map();
  function rank(i) { if(!ranks.has(i)) ranks.set(i, Math.max(-1,...[...before[i]].map(rank))+1); return ranks.get(i); }
  const layers = [];
  ids.forEach(id => { const r=rank(component.get(id)); (layers[r] ||= []).push(id); });
  const order = new Map();
  const update = () => layers.forEach(layer => layer.forEach((id,i) => order.set(id,i-(layer.length-1)/2)));
  update();
  for(let pass=0;pass<6;pass++) {
    const forward=pass%2===0, levels=forward?layers:[...layers].reverse();
    for(const layer of levels) {
      const score=id=> {const neighbors=edges.filter(e=>forward?e.target===id:e.source===id).map(e=>forward?e.source:e.target);return neighbors.length?neighbors.reduce((s,n)=>s+order.get(n),0)/neighbors.length:order.get(id);};
      const scores=new Map(layer.map(id=>[id,score(id)]));
      layer.sort((a,b)=>scores.get(a)-scores.get(b)); update();
    }
  }
  const positions = new Map();
  layers.forEach((layer,r) => layer.forEach((id,i) => positions.set(id,{x:160+r*400,y:100+(i-(layer.length-1)/2 )*190})));
  return positions;
}
