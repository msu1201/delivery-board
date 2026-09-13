// Deterministic orthogonal routes avoid node bodies. Groups are visual boundaries,
// not obstacles; every returned edge still represents the original dependency.
export function intersects(a, b, r) {
  const l = r.x - r.w / 2 - 2,
    right = r.x + r.w / 2 + 2,
    top = r.y - r.h / 2 - 2,
    bottom = r.y + r.h / 2 + 2;
  if (Math.abs(a.y - b.y) < 0.001)
    return (
      a.y > top &&
      a.y < bottom &&
      Math.max(a.x, b.x) > l &&
      Math.min(a.x, b.x) < right
    );
  if (Math.abs(a.x - b.x) < 0.001)
    return (
      a.x > l &&
      a.x < right &&
      Math.max(a.y, b.y) > top &&
      Math.min(a.y, b.y) < bottom
    );
  return true;
}
export function routeEdge(s, t, boxes, index = 0, occupied = []) {
  const a = { x: s.x, y: s.y },
    b = { x: t.x, y: t.y };
  const sx = [18, 34, 50, 66].map(g => s.x + s.w / 2 + g);
  const tx = [18, 34, 50, 66].map(g => t.x - t.w / 2 - g);
  const ys = [...new Set([s.y, t.y, (s.y+t.y)/2,
    ...boxes.flatMap(n => [20,36,52].flatMap(g => [n.y-n.h/2-g,n.y+n.h/2+g]))])];
  let best = null,
    bestLength = Infinity;
  for (const x1 of sx)
    for (const x2 of tx)
      for (const y of ys) {
        const raw = [
          a,
          { x: x1, y: s.y },
          { x: x1, y },
          { x: x2, y },
          { x: x2, y: t.y },
          b,
        ];
        const points = raw.filter(
          (p, i) => !i || p.x !== raw[i - 1].x || p.y !== raw[i - 1].y,
        );
        let valid = true,
          len = 0;
        for (let i = 1; i < points.length; i++) {
          len +=
            Math.abs(points[i].x - points[i - 1].x) +
            Math.abs(points[i].y - points[i - 1].y);
          if (
            boxes.some(
              (n) =>
                !(i === 1 && n.id === s.id) &&
                !(i === points.length - 1 && n.id === t.id) &&
                intersects(points[i - 1], points[i], n),
            )
          ) {
            valid = false;
            break;
          }
        }
        if (valid) {
          for(let k=1;k<points.length;k++) {
            const a=points[k-1], b=points[k], horizontal=a.y===b.y;
            for(const [c,d] of occupied) {
              if(horizontal !== (c.y===d.y)) continue;
              const distance=horizontal?Math.abs(a.y-c.y):Math.abs(a.x-c.x);
              const overlap=horizontal?Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)):Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y));
              if(distance<14 && overlap>1) len += (14-distance)*(overlap+30)*8;
            }
          }
        }
        if (valid && len < bestLength) {
          best = points;
          bestLength = len;
        }
      }
  if (!best) throw Error(`No clear edge route ${s.id} → ${t.id}`);
  return best;
}
export function segmentCoordinates(s, t, points) {
  const dx = t.x - s.x,
    dy = t.y - s.y,
    len = Math.hypot(dx, dy),
    length2 = len * len;
  return {
    weights: points
      .slice(1, -1)
      .map((p) => ((p.x - s.x) * dx + (p.y - s.y) * dy) / length2),
    distances: points
      .slice(1, -1)
      .map((p) => (dx * (p.y - s.y) - dy * (p.x - s.x)) / len),
  };
}

// Allocate ports and reserve complete routes together, rather than independently.
export function routeEdges(boxes, edges) {
  const byId=new Map(boxes.map(b=>[b.id,b]));
  const offsets=(id, outgoing)=>{
    const list=edges.map((e,i)=>({e,i})).filter(({e})=>(outgoing?e.source:e.target)===id)
      .sort((a,b)=>byId.get(outgoing?a.e.target:a.e.source).y-byId.get(outgoing?b.e.target:b.e.source).y || a.i-b.i);
    const spacing=Math.min(18, (byId.get(id).h-32)/Math.max(1,list.length-1));
    return new Map(list.map(({i},j)=>[i,(j-(list.length-1)/2)*spacing]));
  };
  const out=new Map(boxes.map(b=>[b.id,offsets(b.id,true)])), incoming=new Map(boxes.map(b=>[b.id,offsets(b.id,false)]));
  const occupied=[];
  return edges.map((e,i)=>{
    const s=byId.get(e.source),t=byId.get(e.target),sourceOffset=out.get(s.id).get(i),targetOffset=incoming.get(t.id).get(i);
    const points=routeEdge({...s,y:s.y+sourceOffset},{...t,y:t.y+targetOffset},boxes,i,occupied);
    for(let k=1;k<points.length;k++) {
      // Reserve only the visible parts outside the node bodies.
      const a={...points[k-1]},b={...points[k]};
      if(k===1)a.x=s.x+s.w/2;
      if(k===points.length-1)b.x=t.x-t.w/2;
      occupied.push([a,b]);
    }
    return {points,sourceOffset,targetOffset};
  });
}
