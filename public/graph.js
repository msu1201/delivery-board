import { summarizeProgress } from "/progress.js";
import { dependencyLayout } from "./layout.js";
import { routeEdges, segmentCoordinates } from "./routing.js";
import { projectGraph, closure } from "/model.js";
export const statusText = {
  planned: "待规划",
  ready: "已记录 ready",
  in_progress: "进行中",
  verified: "技术已验证",
  awaiting_human: "等待人类验收",
  accepted: "已验收",
  blocked: "受阻",
  unknown: "未知",
};
function compactLabel(text, maxLines = 2) {
  const lines = []; let line = "", width = 0;
  for (const char of String(text)) {
    const size = char.charCodeAt(0) > 255 ? 2 : 1;
    if (width + size > 26) { lines.push(line); line = ""; width = 0; }
    line += char; width += size;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).map((line,i) => i === maxLines-1 && lines.length > maxLines ? line.slice(0,-1)+"…" : line).join("\n");
}
export class GraphCanvas {
  constructor(container, { select, toggle, onZoom }) {
    this.cy = window.cytoscape({
      container,
      elements: [],
      minZoom: 0.06,
      maxZoom: 2.2,
      boxSelectionEnabled: false,
      autoungrabify: true,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: "node",
          style: {
            shape: "round-rectangle",
            width: 240,
            height: 116,
            label: "data(label)",
            "background-color": "data(fill)",
            "border-width": 1.5,
            "border-color": "data(color)",
            color: "#27403a",
            "font-family": "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif",
            "font-size": 15,
            "text-wrap": "wrap",
            "text-max-width": 214,
            "text-valign": "center",
            "text-halign": "center",
            "line-height": 1.4,
          },
        },
        {
          selector: "node[human]",
          style: {
            shape: "round-rectangle",
            "border-width": 2,
            "text-max-width": 214,
            "font-size": 15,
          },
        },
        {
          selector: "node[milestone]",
          style: {
            shape: "barrel",
            "border-style": "double",
            "border-width": 3,
          },
        },
        {
          selector: "node[collapsed]",
          style: {
            width: 240,
            height: 116,
            "background-color": "data(fill)",
            "font-size": 15,
            "text-max-width": 214,
            "border-color": "data(color)",
          },
        },
        {
          selector: ":parent",
          style: {
            shape: "round-rectangle",
            "background-color": "#edf3ed",
            "background-opacity": 0.5,
            "border-color": "#cbdacb",
            "border-width": 1,
            padding: 28,
            "text-valign": "top",
            "text-halign": "left",
            "text-margin-x": 12,
            "text-margin-y": -9,
            "font-size": 15,
            color: "#537260",
          },
        },
        {
          selector: "node[external]",
          style: {
            shape: "round-rectangle",
            "border-style": "dashed",
            "background-color": "#f9f2e8",
            "border-color": "#be9a73",
            "font-size": 15,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.8,
            "line-color": "#829baf",
            "target-arrow-color": "#809b8b",
            "target-arrow-shape": "triangle",
            "curve-style": "round-segments",
            "segment-radii": 8,
            "edge-distances": "node-position",
            "source-endpoint": "data(sourcePort)",
            "target-endpoint": "data(targetPort)",
            "segment-weights": "data(weights)",
            "segment-distances": "data(distances)",
            "arrow-scale": 0.8,
            label: "data(label)",
            "font-size": 10,
            color: "#597565",
            "text-background-color": "#fcfdfb",
            "text-background-opacity": 1,
            "text-background-padding": 3,
          },
        },
        { selector: "edge[activeLink]", style: { "line-color": "#397bbf", "target-arrow-color": "#397bbf", width: 2.5 } },
        { selector: ".dim", style: { opacity: 0.16 } },
        {
          selector: ".chain",
          style: {
            "line-color": "#24785f",
            "target-arrow-color": "#24785f",
            width: 2.7,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#24374b",
            "border-width": 3,
            "border-style": "double",
          },
        },
        { selector: "node[active], node[activeGroup]", style: { "background-color": "#eaf2ff", "border-color": "#2864ae", "border-width": 3, opacity: 1 } },
        { selector: "node[active]:selected", style: { "border-color": "#24374b", "border-width": 5 } },
      ],
    });
    this.cy.on("tap", "node", (e) => {
      const d = e.target.data();
      if (d.collapsed || d.groupBoundary) toggle(d.groupId);
      else select(d.originalId);
    });
    this.cy.on("zoom", () => onZoom(this.cy.zoom()));
    this.cy.on("pan zoom resize", () => this.updateMapViewport());
    this.resizeObserver = new ResizeObserver(() => this.cy.resize());
    this.resizeObserver.observe(container);
  }
  draw(
    graph,
    view,
    expanded,
    { preserve = true, selected = null, focus = null, journeyId = null } = {},
  ) {
    this.cy.resize();
    const cy = this.cy,
      viewport = { zoom: cy.zoom(), pan: cy.pan() },
      p = projectGraph(graph, view, expanded, journeyId),
      elements = [];
    const positions = dependencyLayout(p.entities, p.edges);
    for (const e of p.entities) {
      let data;
      if (e.group) {
        const progress = summarizeProgress(e.members);
        const fullTotal = graph.nodes.filter(n=>n.groupId===e.groupId).length;
        data = {
          id: e.id,
          groupId: e.groupId,
          collapsed: true,
          label: `分组 · ${compactLabel(e.group.title,1)}\n${progress.label} · 已完成 ${progress.completed}/${progress.total}\n${progress.active} 进行中 · ${progress.blocked} 受阻 · ${progress.waiting} 待验收${fullTotal !== progress.total ? "\n仅当前视图范围" : ""}`,
          color: progress.border, fill: progress.fill, progressState: progress.state,
        };
        const activeCount = e.members.filter(n => n.status === "in_progress").length;
        if (activeCount) data.activeGroup = true;
      } else {
        const n = e.node;
        data = {
          id: e.id,
          originalId: n.id,
          label: `${e.external ? "外部前置 · " : ""}${n.id}${n.humanGate ? " ◇" : ""}\n${compactLabel(n.title)}\n${n.status === "in_progress" ? "● 正在进行" : statusText[n.status] || "未知"} · ${compactLabel(graph.groups.find(g => g.id === n.groupId)?.title || "", 1)}`,
          color: summarizeProgress([n]).border, fill: summarizeProgress([n]).fill, progressState: summarizeProgress([n]).state,
        };
        if (n.status === "in_progress") data.active = true;
        if (n.humanGate || n.kind === "human") data.human = true;
        if (n.kind === "milestone") data.milestone = true;
        if (e.external) data.external = true;
      }
      elements.push({ data, position: positions.get(e.id) });
    }
    const boxes = p.entities.map((e) => ({
      id: e.id,
      ...positions.get(e.id),
      w: 240,
      h: 116,
    }));
    const routes = routeEdges(boxes, p.edges);
    p.edges.forEach((e, i) => {
      const s = boxes.find((b) => b.id === e.source),
        t = boxes.find((b) => b.id === e.target),
        route = routes[i].points,
        coordinates = segmentCoordinates(s, t, route);
      elements.push({
        data: {
          id: `edge:${i}`,
          source: e.source,
          target: e.target,
          label: e.count > 1 ? `${e.count} 条依赖` : "",
          dependencies: e.dependencies,
          sourcePort: `${s.w/2}px ${routes[i].sourceOffset}px`,
          targetPort: `${-t.w/2}px ${routes[i].targetOffset}px`,
          ...(e.dependencies.some(d => graph.nodes.some(n => n.status === "in_progress" && (n.id === d.source || n.id === d.target))) ? {activeLink:true} : {}),
          ...coordinates,
        },
      });
    });
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
    cy.layout({ name: "preset", fit: false }).run();
    if (preserve) {
      cy.zoom(viewport.zoom);
      cy.pan(viewport.pan);
    } else {
      cy.zoom(1);
      const active = cy.nodes("[active]");
      const anchor = active.length ? active[0] : cy.nodes()[0];
      if (anchor) { const a=anchor.position(); cy.pan({x:cy.width()/2-a.x,y:cy.height()*(active.length ? .28 : .5)-a.y}); }
    }
    if (selected) cy.getElementById(selected).select();
    if (focus) this.highlight(graph, focus);
    this.projection = p;
    this.renderMap();
    return p;
  }
  renderMap() {
    const host = document.getElementById("minimap");
    if (!host) return;
    const ns = "http://www.w3.org/2000/svg", make = (tag, attrs) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v)); return e;
    };
    host.replaceChildren();
    if (!this.cy.nodes().length) return;
    const bounds = this.cy.elements().boundingBox();
    this.mapBounds = {x:bounds.x1-40,y:bounds.y1-40,w:bounds.w+80,h:bounds.h+80};
    const b=this.mapBounds;
    const svg = make("svg",{viewBox:`${b.x} ${b.y} ${b.w} ${b.h}`, role:"img", tabindex:"0", "aria-label":"整体依赖小地图，蓝色是当前任务；框线是当前视野。点击或使用方向键移动视野"});
    this.cy.edges().forEach(e => { const a=e.source().position(),b=e.target().position(); svg.append(make("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"#a5b8c7","stroke-width":5})); });
    this.cy.nodes().forEach(n => {const p=n.position();svg.append(make("rect",{x:p.x-120,y:p.y-58,width:240,height:116,rx:14,fill:n.data("color")||"#d6e2e7",stroke:"#8ba2ae","stroke-width":3}));});
    this.mapViewport=make("rect",{fill:"#2864ae","fill-opacity":0.08,stroke:"#2864ae","stroke-width":6,"pointer-events":"none"});
    svg.append(this.mapViewport);host.append(svg);
    svg.addEventListener("click",e=>{const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform(svg.getScreenCTM().inverse());this.cy.pan({x:this.cy.width()/2-p.x*this.cy.zoom(),y:this.cy.height()/2-p.y*this.cy.zoom()});});
    svg.addEventListener("keydown",e=> { const moves={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]}; if(moves[e.key]) { e.preventDefault(); const [x,y]=moves[e.key]; this.cy.panBy({x,y}); } });
    this.updateMapViewport();
  }
  updateMapViewport() {
    if(!this.mapViewport) return;
    const p=this.cy.pan(),z=this.cy.zoom();
    Object.entries({x:-p.x/z,y:-p.y/z,width:this.cy.width()/z,height:this.cy.height()/z}).forEach(([k,v])=>this.mapViewport.setAttribute(k,v));
  }
  highlight(graph, id) {
    const related = new Set([
      ...closure(graph, [id]),
      ...closure(graph, [id], "descendants"),
    ]);
    this.cy.elements().removeClass("dim chain");
    this.cy.nodes().forEach((n) => {
      if (n.isParent()) return;
      if (!related.has(n.data("originalId"))) n.addClass("dim");
    });
    this.cy.edges().forEach((e) => {
      const refs = e.data("dependencies");
      if (refs.some((d) => related.has(d.source) && related.has(d.target)))
        e.addClass("chain");
      else e.addClass("dim");
    });
  }
  locate(id) {
    const n = this.cy.getElementById(id);
    if (n.length) {
      this.cy.nodes().unselect();
      n.select();
      this.cy.zoom(0.9);
      this.cy.center(n);
    }
  }
  fit() {
    this.cy.fit(undefined, 40);
  }
  zoom(factor) {
    this.cy.zoom({
      level: this.cy.zoom() * factor,
      renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 },
    });
  }
}
