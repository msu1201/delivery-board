import test from "node:test";
import assert from "node:assert/strict";
import { routeEdge, intersects } from "../public/routing.js";
test("long dependency routes around intermediate nodes instead of through labels", () => {
  const boxes = [
    { id: "s", x: 0, y: 0, w: 210, h: 140 },
    { id: "middle", x: 285, y: 0, w: 210, h: 140 },
    { id: "t", x: 570, y: 0, w: 210, h: 140 },
  ];
  const points = routeEdge(boxes[0], boxes[2], boxes, 0);
  assert.ok(points.length > 2);
  for (let i = 1; i < points.length; i++)
    assert.equal(intersects(points[i - 1], points[i], boxes[1]), false);
});
test("mixed group and node widths leave safe routes across rows", () => {
  const boxes = [
    { id: "a", x: 150, y: 90, w: 210, h: 140 },
    { id: "b", x: 180, y: 300, w: 255, h: 145 },
    { id: "c", x: 435, y: 500, w: 210, h: 140 },
  ];
  const points = routeEdge(boxes[0], boxes[2], boxes, 2);
  for (let i = 1; i < points.length; i++)
    assert.equal(intersects(points[i - 1], points[i], boxes[1]), false);
});
test('shared source dependencies use distinct ports and separated vertical tracks', async () => {
  const { routeEdges } = await import('../public/routing.js');
  const boxes=[{id:'s',x:0,y:0,w:240,h:116},...[180,360,540].map((y,i)=>({id:`t${i}`,x:400,y,w:240,h:116}))];
  const edges=boxes.slice(1).map(t=>({source:'s',target:t.id}));
  const routes=routeEdges(boxes,edges);
  assert.equal(new Set(routes.map(r=>r.sourceOffset)).size,3);
  const tracks=routes.map(r=>r.points.find((p,i)=>i&&p.x===r.points[i-1].x&&Math.abs(p.y-r.points[i-1].y)>20)?.x).filter(x=>x!==undefined);
  for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++)assert.ok(Math.abs(tracks[i]-tracks[j])>=12);
  assert.deepEqual(routes,routeEdges(boxes,edges));
  routes.forEach((r,i)=>{for(let k=1;k<r.points.length;k++) boxes.filter(b=>b.id!=='s'&&b.id!==edges[i].target).forEach(b=>assert.equal(intersects(r.points[k-1],r.points[k],b),false));});
});
