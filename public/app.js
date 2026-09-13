import { renderWorkLog } from "./work-log.js";
import { AutoRefresh } from "./auto-refresh.js";
import { summarizeProgress, journeyProgress } from "/progress.js";
import { installPanelResize } from "./resize-panel.js";
import { GraphCanvas, statusText } from "./graph.js";
import {
  RefreshController,
  safeWebURL,
  LatestOnly,
  deliveryState,
  ciSummary,
} from "./client-state.js";
import { currentWork } from "/current-work.js";
import { closure, analyze } from "/model.js";
installPanelResize();
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const button = (text, click, cls) => {
  const b = el("button", text, cls);
  b.addEventListener("click", click);
  return b;
};
const state = {
  snapshot: null,
  graph: null,
  view: null,
  expanded: new Set(),
  selected: null,
  focus: null,
  search: "",
  journey: null,
  currentId: null,
};
const canvas = new GraphCanvas($("cy"), {
  select: (id) => select(id),
  toggle: (id) => toggle(id),
  onZoom: (z) => ($("zoom-value").textContent = `${Math.round(z * 100)}%`),
});
let graphDrawn = false;
let displayMode = "graph";
try { displayMode = localStorage.getItem("delivery-board.view-mode") === "history" ? "history" : "graph"; } catch {}
if (new URLSearchParams(location.search).get("view") === "history") displayMode = "history";
function updateHistory() {
  renderWorkLog($("work-history"), state.graph, id => { setMode("graph"); select(id); });
}
function setMode(mode) {
  displayMode = mode;
  document.body.classList.toggle("history-mode", mode === "history");
  $("work-history").hidden = mode !== "history";
  $("mode-graph").setAttribute("aria-pressed", mode === "graph");
  $("mode-history").setAttribute("aria-pressed", mode === "history");
  try { localStorage.setItem("delivery-board.view-mode", mode); } catch {}
  if (mode === "history") updateHistory();
  else if (state.graph) { canvas.cy.resize(); renderGraph(true); }
}
$("mode-graph").onclick = () => setMode("graph");
$("mode-history").onclick = () => setMode("history");
setMode(displayMode);
async function fetchJSON(url) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(`读取失败 HTTP ${response.status}；请重新载入或重启本地服务`);
  return response.json();
}
function time(t) {
  return t ? new Date(t).toLocaleString("zh-CN", { hour12: false }) : "未知";
}
const refresh = new RefreshController(
  () => fetchJSON("/api/snapshot"),
  (snapshot) => {
    const first = !state.graph;
    const previous = state.snapshot;
    const sameSource = !first && snapshot.graph && previous?.freshness?.hash === snapshot.freshness?.hash && JSON.stringify(previous?.freshness?.git) === JSON.stringify(snapshot.freshness?.git);
    state.snapshot = snapshot;
    $("alert").classList.toggle("error", snapshot.stale);
    $("alert").textContent = snapshot.stale
      ? `⚠ STALE / ERROR · ${snapshot.error}。${snapshot.graph ? "保留上次成功图；不是最新状态。" : "尚无有效快照。"} 尝试 ${time(snapshot.attemptedAt)}`
      : "✓ 已读取保存的记录 · 只读 · 远端 CI 未重新查询";
    $("refresh").textContent = "↻ 刷新记录";
    if (!snapshot.graph) { $("current-note").textContent = "尚无有效记录，当前任务未知。"; return; }
    if (sameSource) {
      $("read-time").textContent = `成功读取 ${time(snapshot.freshness.completedAt)}`;
      const lines = $("sources").children;
      if (lines[1]) lines[1].textContent = `读取开始：${time(snapshot.freshness.startedAt)}`;
      if (lines[2]) lines[2].textContent = `读取完成：${time(snapshot.freshness.completedAt)}`;
      if (previous.stale !== snapshot.stale) renderCurrentWork();
      return;
    }
    state.graph = snapshot.graph;
    updateHistory();
    if (state.focus && !state.graph.nodes.some(n => n.id === state.focus)) {
      state.focus = null;
      $("clear-focus").hidden = true;
    }
    const policy = state.graph.ciPolicy;
    $("ci-policy").hidden = policy == null;
    $("ci-policy").replaceChildren();
    if (policy != null) {
      const d = el("details");
      d.append(
        el(
          "summary",
          `项目 CI：${ciSummary(policy).label}${policy.decision_ref ? ` · ${policy.decision_ref}` : ""}`,
        ),
      );
      d.append(ciPolicyDetails(policy));
      $("ci-policy").append(d);
    }
    state.view = state.view === null || state.graph.views.some((v) => v.id === state.view) ? state.view : null;
    const active = currentWork(state.graph);
    if (!active.some(c => c.node.id === state.currentId)) state.currentId = active[0]?.node.id || null;
    if (first) active.forEach(c => state.expanded.add(c.node.groupId));
    renderCurrentWork();
    if (
      state.selected &&
      !state.graph.nodes.some((n) => n.id === state.selected)
    ) {
      state.selected = null;
      $("detail").replaceChildren(el("p", "原选中节点已从来源移除。"));
    }
    if (
      state.journey &&
      !state.graph.journeys?.some((j) => j.id === state.journey)
    ) {
      state.journey = null;
      state.selected = null;
      $("detail").replaceChildren(el("p", "原闭环记录已移除；验收未知。"));
    }
    const f = snapshot.freshness;
    $("project-name").textContent = state.graph.project.name;
    $("version").textContent =
      `${f.git.branch || "分支未知"} · ${(f.git.head || "版本未知").slice(0, 12)} · ${f.git.dirty === null ? "dirty 未知" : f.git.dirty ? "来源文件有未提交更改" : "来源文件 clean"}`;
    $("read-time").textContent = `成功读取 ${time(f.completedAt)}`;
    $("sources").replaceChildren(
      ...[
        `只读根目录：${f.root}`,
        `读取开始：${time(f.startedAt)}`,
        `读取完成：${time(f.completedAt)}`,
        `来源时间（mtime）：${time(f.sourceTime)}`,
        `SHA256：${f.hash}`,
        `Git HEAD：${f.git.head || "未知"}`,
        `dirty 范围：${f.git.dirtyScope}`,
        `远端 CI 观察时间：以节点记录为准，缺失即未知`,
        ...f.files.map(
          (s) => `${s.path} · ${s.hash.slice(0, 12)} · ${time(s.mtime)}`,
        ),
      ].map((x) => el("p", x)),
    );
    renderNav();
    renderGraph(!first);
    if (state.selected) renderDetail();
    else if (state.journey) renderJourney();
  },
);
function checkpointSummary(node) {
  const summary = node?.checkpoint?.summary;
  return typeof summary === "string" && summary.trim()
    ? `最近检查点（来源记录）：${summary}`
    : "检查点未记录";
}
function renderCurrentWork() {
  const active = currentWork(state.graph);
  $("current-note").textContent = `${state.snapshot.stale ? "上次成功记录（已过期）" : "依据已保存记录"} · ${active.length ? `${active.length} 项进行中` : "当前没有记录进行中的任务"}`;
  $("locate-current").disabled = !active.length;
  $("current-tasks").replaceChildren(...active.map(c => {
    const b = button(`● ${c.node.id} · ${c.node.title}`, () => { state.currentId = c.node.id; renderCurrentWork(); }, "current-task");
    b.setAttribute("aria-pressed", c.node.id === state.currentId);
    return b;
  }));
  const c = active.find(c => c.node.id === state.currentId);
  $("current-context").replaceChildren();
  $("current-more").hidden = !c;
  $("current-position").textContent = c ? `${c.group?.title || ""} → ${c.journeys.map(j => j.id + " · " + j.title).join(" / ") || "闭环未记录"}` : "";
  $("current-checkpoint").hidden = !c;
  $("current-checkpoint").textContent = c ? checkpointSummary(c.node) : "";
  if (!c) return;
  const names = records => records.length ? records.map(n => `${n.id} · ${n.title}`).join("；") : "无记录";
  const rows = [
    ["所属分组", c.group?.title || "未知"],
    ["关联闭环", names(c.journeys)],
    ["里程碑范围", names(c.scopeMilestones)],
    ["依赖通往", names(c.downstreamMilestones)],
    ["未满足前置", c.unmet.join("、") || "无"],
    ["直接后续", names(c.successors)],
  ];
  const list = el("dl", undefined, "current-facts");
  rows.forEach(([label, value]) => { const row = el("div"); row.append(el("dt", label), el("dd", value)); list.append(row); });
  $("current-context").append(list);
  if (c.hasOwnBlocker || c.blockedBy.length) $("current-context").append(el("p", "此进行中任务仍有阻塞记录，请查看节点详情。", "warn"));
}
function showRoadmap(locate = false) {
  if (!state.graph) return;
  state.view = null;
  state.journey = null;
  state.focus = null;
  state.search = "";
  $("search").value = "";
  $("clear-focus").hidden = true;
  currentWork(state.graph).forEach(c => state.expanded.add(c.node.groupId));
  renderNav();
  renderGraph(false);
  if (!locate) canvas.fit();
  if (locate && state.currentId) select(state.currentId);
  else if (state.selected) renderDetail();
  else $("detail").replaceChildren(el("p", "选择节点查看依赖与证据。"));
}
$("close-detail").onclick = () => { state.selected = null; state.journey = null; renderNav(); renderGraph(true); };
$("roadmap-overview").onclick = () => showRoadmap();
$("locate-current").onclick = () => showRoadmap(true);
function renderNav() {
  const records = state.graph.journeys || [];
  $("journey-select").replaceChildren(el("option", "全部任务"));
  $("journey-select").firstChild.value = "";
  for (const j of records) {
    const p = journeyProgress(state.graph, j);
    const option = el("option", `${p.icon} ${j.id} · ${j.title} · ${p.label} · 环节 ${p.completed}/${p.total}`);
    option.value = j.id;
    $("journey-select").append(option);
  }
  $("journey-select").disabled = !records.length;
  $("journey-select").value = state.journey || "";
  $("journey-note").textContent = state.journey
    ? "显示关联任务与真实前置；闭环状态来自独立记录。"
    : records.length
      ? "选择一个闭环，逐项查看独立验收。关联任务通过不代表闭环通过。"
      : "未提供闭环记录；闭环验收未知。";
  $("views").replaceChildren(
    ...state.graph.views.map((v) => {
      const b = button(
        v.title,
        () => {
          state.view = v.id;
          state.journey = null;
          if (!state.selected)
            $("detail").replaceChildren(
              el("p", "选择节点或用户闭环查看证据。"),
            );
          state.focus = null;
          $("clear-focus").hidden = true;
          renderNav();
          renderGraph(false);
        },
        "view-button",
      );
      b.setAttribute("aria-pressed", v.id === state.view);
      return b;
    }),
  );
  $("groups").replaceChildren(
    ...state.graph.groups.map((g) => {
      const b = button("", () => toggle(g.id), "group-button");
      b.append(
        el("span", state.expanded.has(g.id) ? "−" : "+"),
        el("span", g.title + (state.graph.nodes.some(n => n.groupId === g.id && n.status === "in_progress") ? ` · ${state.graph.nodes.filter(n => n.groupId === g.id && n.status === "in_progress").length} 进行中` : "")),
        el(
          "span",
          String(state.graph.nodes.filter((n) => n.groupId === g.id).length),
          "count",
        ),
      );
      const progress = summarizeProgress(state.graph.nodes.filter(n=>n.groupId===g.id));
      const hint = el("span", `${progress.label} · 已完成 ${progress.completed}/${progress.total}`, "group-progress");
      hint.style.color = progress.border;
      b.append(hint);
      b.setAttribute("aria-expanded", state.expanded.has(g.id));
      return b;
    }),
  );
  $("expand-all").textContent =
    state.expanded.size === state.graph.groups.length ? "折叠全部" : "展开全部";
}
function renderGraph(preserve = true) {
  if (displayMode === "history") return;
  document.body.classList.toggle("has-detail", !!(state.selected || state.journey));
  const p = canvas.draw(state.graph, state.view, state.expanded, {
    preserve: preserve && graphDrawn,
    selected: state.selected,
    focus: state.focus,
    journeyId: state.journey,
  });
  graphDrawn = true;
  const v = state.graph.views.find((v) => v.id === state.view);
  const journey = state.graph.journeys?.find((j) => j.id === state.journey);
  $("view-title").textContent = journey
    ? `${journey.id} · ${journey.title}`
    : v?.title || "整体路线";
  $("journey-summary").replaceChildren();
  $("journey-summary").hidden = !journey;
  if (journey) $("journey-summary").append(journeyStatus(journey));
  $("counts").textContent =
    `${p.visible.length} / ${state.graph.nodes.length} 个节点 · ${p.visible.reduce((s, n) => s + n.dependsOn.length, 0)} 条真实前置 · ${p.external.length} 个外部前置`;
  const filtered = state.graph.nodes.filter(
    (n) =>
      !state.search ||
      `${n.id} ${n.title}`
        .toLocaleLowerCase()
        .includes(state.search.toLocaleLowerCase()),
  );
  const listed = state.search ? filtered : p.visible;
  $("result-count").textContent = `（${listed.length}）`;
  $("node-list").replaceChildren(
    ...listed.map((n) => {
      const b = button(`${n.humanGate ? "◇ " : ""}${n.id} · ${n.title}${n.status === "in_progress" ? " · ● 进行中" : ""}`, () =>
        select(n.id),
      );
      b.setAttribute("aria-pressed", n.id === state.selected);
      return b;
    }),
  );
  if (!listed.length) $("node-list").append(el("p", "没有匹配节点。"));
}
function toggle(id) {
  state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
  renderNav();
  renderGraph(false);
}
function select(id) {
  const n = state.graph.nodes.find((n) => n.id === id);
  if (!n) return;
  state.selected = id;
  state.expanded.add(n.groupId);
  if (!canvas.projection?.visible.some((x) => x.id === id)) {
    state.view = null;
    state.journey = null;
  }
  renderNav();
  renderGraph(true);
  canvas.locate(id);
  renderDetail();
  if (innerWidth <= 850) $("detail").scrollIntoView({ block: "start" });
}
function section(title) {
  const s = el("section", undefined, "detail-section");
  s.append(el("h3", title));
  return s;
}
function fact(list, label, value, warn = false) {
  const row = el("div", undefined, "status-row");
  row.append(el("dt", label), el("dd", value, warn ? "warn" : ""));
  list.append(row);
}
function ciPolicyDetails(policy) {
  const d = el("div");
  if (policy && typeof policy === "object") {
    for (const [key, label] of Object.entries({
      decision_ref: "决策",
      reason: "原因",
      replacement: "替代验证要求",
      effective_on: "生效日期",
      until: "有效期",
    }))
      if (policy[key]) d.append(el("p", `${label}：${policy[key]}`));
  } else if (policy != null) d.append(el("p", String(policy)));
  return d;
}
function renderCI(n) {
  const current = section("当前 CI 要求与记录");
  current.classList.add("ci-current");
  const policy = n.delivery?.ci ?? state.graph.ciPolicy;
  const summary = ciSummary(policy);
  current.append(
    el("strong", summary.label),
    el(
      "p",
      n.delivery?.ci != null
        ? "来源：当前任务的交付记录"
        : "来源：项目策略；任务未另行记录",
    ),
    ciPolicyDetails(policy),
  );
  const historical = section("历史 CI 观察（保留原结果）");
  historical.classList.add("ci-history");
  const checkpoint = n.checkpoint;
  if (checkpoint?.ci != null || checkpoint?.ci_observation != null) {
    historical.append(
      el(
        "p",
        "以下是此前保存的观察，不替代当前策略，也不是本次重新运行的结果。",
      ),
    );
    if (checkpoint.ci != null)
      historical.append(
        el(
          "p",
          typeof checkpoint.ci === "string"
            ? checkpoint.ci
            : JSON.stringify(checkpoint.ci),
        ),
      );
    if (checkpoint.ci_observation != null)
      historical.append(
        el("pre", JSON.stringify(checkpoint.ci_observation, null, 2)),
      );
  } else historical.append(el("p", "未记录历史 CI 观察；未查询远端。"));
  return [current, historical];
}
function renderDetail() {
  const n = state.graph.nodes.find((n) => n.id === state.selected),
    a = analyze(state.graph)[n.id],
    detail = $("detail");
  detail.replaceChildren(
    el(
      "div",
      `${n.humanGate ? "◇ 人类关卡 · " : ""}${n.id} / ${n.kind}`,
      "node-id",
    ),
    el("h2", n.title, "detail-title"),
    el("p", checkpointSummary(n), "checkpoint-summary"),
  );
  const dl = el("dl");
  fact(dl, "账本状态", statusText[n.status] || "未知", n.status === "blocked");
  fact(
    dl,
    "本地验证",
    n.localVerification === "verified" ? "已完成（来源记录）" : "未知 / 未记录",
  );
  fact(
    dl,
    "范围验收",
    n.status === "accepted"
      ? "已验收"
      : n.deferral?.status === "deferred"
        ? "人类验收已延期，未豁免"
        : n.status === "awaiting_human"
          ? "等待人类验收"
          : "未记录完成",
  );
  fact(
    dl,
    "合并交付",
    deliveryState(n.delivery?.status) === "delivered"
      ? "已交付（账本记录）"
      : deliveryState(n.delivery?.status) === "pending"
        ? `尚未交付 · ${n.delivery.status}`
        : "未知 / 未记录",
    n.delivery?.status === "pending_integration",
  );
  fact(
    dl,
    "前置条件",
    a.unmet.length
      ? `未满足：${a.unmet.join("、")}`
      : n.dependsOn.length
        ? "直接前置状态已满足"
        : "无前置（不代表开工授权）",
  );
  if (state.journey)
    detail.prepend(
      button("返回闭环验收", () => {
        state.selected = null;
        renderJourney();
      }),
    );
  detail.append(dl, ...renderCI(n));
  if (n.kind === "milestone" && !n.children?.length)
    detail.append(
      el(
        "p",
        "范围未完全展开 · 子项与覆盖仍未知，不计算完成百分比。",
        "scope-unknown",
      ),
    );
  const journeys = section("用户闭环");
  if (n.journeys?.length)
    for (const j of n.journeys) {
      const d = el("div", undefined, "journey");
      d.append(
        el("strong", `${j.id} ${j.title}`),
        el("p", j.outcome),
        el("p", `恢复与边界：${j.boundaries}`),
        el("p", `来源覆盖说明：${j.coverage}`),
      );
      journeys.append(d);
    }
  else journeys.append(el("p", "来源未提供更细的用户闭环。"));
  detail.append(journeys);
  const acceptance = section(
    n.kind === "milestone" ? "里程碑门槛" : "验收条件",
  );
  const ul = el("ul");
  for (const t of n.acceptance) ul.append(el("li", t));
  acceptance.append(n.acceptance.length ? ul : el("p", "未知 / 未记录"));
  detail.append(acceptance);
  const blockers = section("阻塞责任与解除动作");
  if (n.blockers?.length)
    for (const b of n.blockers) {
      const d = el("div", undefined, "blocker");
      d.append(
        el(
          "strong",
          `${b.id || "阻塞"} · ${b.state || "状态未知"}${b.resolution === "waived_by_user" ? " · 用户豁免解除" : ""}`,
        ),
        el("p", `责任方：${b.owner || "未知"}`),
        el("p", `解除条件：${b.exit || "未知"}`),
        el("p", `下一步：${b.next_action || "未知"}`),
      );
      blockers.append(d);
    }
  else blockers.append(el("p", "直接阻塞记录：未知 / 未提供"));
  if (a.blockedBy.length)
    blockers.append(el("p", `受到上游阻塞影响：${a.blockedBy.join("、")}`));
  if (n.deferral)
    blockers.append(
      el(
        "p",
        `延期记录：${n.deferral.scope || n.deferral.status}；安排时间：${n.deferral.scheduled_for || "未知"}`,
      ),
    );
  detail.append(blockers);
  const deps = section("前置与后续");
  deps.append(el("p", "直接前置"));
  for (const id of n.dependsOn) deps.append(button(id, () => select(id)));
  if (!n.dependsOn.length) deps.append(el("p", "无"));
  deps.append(el("p", "直接后续"));
  for (const target of state.graph.nodes.filter((t) =>
    t.dependsOn.includes(n.id),
  ))
    deps.append(button(target.id, () => select(target.id)));
  const count = closure(state.graph, [n.id], "descendants").size - 1;
  deps.append(el("p", `传递后续 ${count} 个节点（不是时间关键路径）`));
  deps.append(
    button("聚焦这条依赖链", () => {
      state.focus = n.id;
      state.journey = null;
      state.expanded = new Set(state.graph.groups.map((g) => g.id));
      const all = state.graph.views.find((v) => v.mode === "all");
      if (all) state.view = all.id;
      $("clear-focus").hidden = false;
      renderNav();
      renderGraph(false);
      canvas.locate(n.id);
    }),
  );
  detail.append(deps);
  detail.append(
    referenceSection("证据与需求来源", [
      ...(n.evidence || []),
      ...(n.references || []),
    ]),
  );
  const technical = el("details", undefined, "technical");
  technical.append(
    el("summary", "技术详情与原始记录"),
    el("p", "CI 来自账本；未重新查询远端。观察时间缺失时为未知。"),
    el(
      "pre",
      JSON.stringify(
        n.recorded || {
          checkpoint: n.checkpoint,
          approval: n.approval,
          delivery: n.delivery,
        },
        null,
        2,
      ),
    ),
  );
  detail.append(technical);
}
function referenceSection(title, items) {
  const refs = section(title);
  if (!items.length) refs.append(el("p", "未知 / 未记录"));
  for (const item of items) {
    const row = el("div", undefined, "ref-row"),
      href = safeWebURL(item.ref),
      evidence = state.snapshot.evidenceRefs?.find((e) => e.ref === item.ref);
    if (href) {
      const a = el("a", item.label);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      row.append(a, el("p", "外部来源 · 未主动核验"));
    } else if (evidence) {
      row.append(button(item.label, () => showEvidence(evidence.id, item.ref)));
    } else row.append(el("span", `${item.label} · 未开放读取 / 不安全链接`));
    refs.append(row);
  }
  return refs;
}
function journeyStatus(j) {
  const p=journeyProgress(state.graph,j),box=el("div",undefined,"journey-status");
  box.style.setProperty("--status-fill",p.fill);box.style.setProperty("--status-color",p.border);
  box.append(el("strong",`${p.icon} ${p.label}`));
  box.append(el("p",`关联环节：已完成 ${p.completed}/${p.total} · 进行中 ${p.active} · 受阻 ${p.blocked} · 待验收 ${p.waiting}`));
  box.append(el("p",p.activeNodes.length ? `当前环节：${p.activeNodes.map(n=>`${n.id} · ${n.title}`).join("；")}` : "当前环节：未记录进行中的关联任务"));
  const stages=el("div",undefined,"journey-stages");
  ["本地验证","闭环验收","合并交付"].forEach((name,i)=>stages.append(el("span",`${p.stages[i]?'✓':'○'} ${name}`,p.stages[i]?"stage-done":"")));
  box.append(stages,el("small",`闭环确认 ${p.stageCompleted}/3 阶段 · 环节按关联任务计数，不代表执行顺序或闭环已通过`));
  return box;
}
function renderJourney() {
  const j = state.graph.journeys.find((j) => j.id === state.journey),
    detail = $("detail");
  detail.replaceChildren(
    el("div", `${j.id} / 用户闭环`, "node-id"),
    el("h2", j.title, "detail-title"),
    journeyStatus(j),
    el("p", j.outcome),
  );
  detail.append(el("p", `恢复与边界：${j.boundaries}`));
  if (j.recordSource === "narrative")
    detail.append(
      el(
        "p",
        "仅有 Markdown 叙述映射；没有独立闭环验收记录，状态未知。",
        "scope-unknown",
      ),
    );
  else
    detail.append(
      el(
        "p",
        "独立闭环记录 · 关联任务的完成不自动证明这个闭环通过。",
        "scope-unknown",
      ),
    );
  if (j.note) detail.append(el("p", j.note));
  const dl = el("dl"),
    lv = j.localVerification,
    ar = j.acceptanceReview,
    d = j.delivery;
  fact(
    dl,
    "本地验证",
    lv
      ? {
          not_assessed: "尚未评估",
          partial: "部分验证，未全部通过",
          passed: "本地验证通过（记录）",
        }[lv.status]
      : "未知 / 未记录",
    lv?.status === "partial",
  );
  fact(
    dl,
    "范围验收",
    ar
      ? ar.status === "accepted"
        ? "已验收（闭环记录）"
        : "未验收"
      : "未知 / 未记录",
    ar?.status === "not_accepted",
  );
  fact(
    dl,
    "合并交付",
    d
      ? d.status === "delivered"
        ? "已交付（闭环记录）"
        : "尚未交付"
      : "未知 / 未记录",
    d?.status === "pending_integration",
  );
  fact(dl, "验证版本", lv?.testedCommit || "未知 / 未记录");
  detail.append(dl);
  const criteria = section("闭环验收条件");
  if (j.acceptanceCriteria.length) {
    const list = el("ul");
    j.acceptanceCriteria.forEach((x) => list.append(el("li", x)));
    criteria.append(list);
  } else criteria.append(el("p", "未知 / 未记录"));
  detail.append(criteria);
  const tasks = section("关联任务与依赖");
  tasks.append(
    el(
      "p",
      "关联关系不新增依赖、不复制任务。图中同时显示这些任务的全部真实前置。",
    ),
  );
  j.itemIds.forEach((id) => tasks.append(button(id, () => select(id))));
  if (!j.itemIds.length) tasks.append(el("p", "关联任务未知"));
  detail.append(tasks);
  detail.append(
    referenceSection("本地验证证据", lv?.evidence || []),
    referenceSection("范围验收证据", ar?.evidence || []),
    referenceSection("合并交付证据", d?.evidence || []),
  );
}
$("journey-select").onchange = (e) => {
  state.journey = e.target.value || null;
  state.selected = null;
  state.focus = null;
  $("clear-focus").hidden = true;
  state.search = "";
  $("search").value = "";
  if (state.journey)
    state.expanded = new Set(state.graph.groups.map((g) => g.id));
  renderNav();
  renderGraph(false);
  if (state.journey) renderJourney();
  else $("detail").replaceChildren(el("p", "选择节点或用户闭环查看证据。"));
};
const evidenceRequest = new LatestOnly();
async function showEvidence(id, ref) {
  $("evidence-title").textContent = ref;
  $("evidence-content").textContent = "读取中…";
  $("evidence-meta").textContent = "";
  $("evidence-dialog").showModal();
  await evidenceRequest.run(
    async () => {
      const data = await fetchJSON(`/api/evidence?id=${id}`);
      if (data.ref !== ref) throw Error("证据身份不一致，请刷新记录");
      return data;
    },
    (error, data) => {
      if (error) {
        $("evidence-content").textContent = `证据读取失败：${error.message}`;
        return;
      }
      $("evidence-content").textContent = data.content;
      $("evidence-meta").textContent =
        `证据独立读取 ${time(data.readAt)} · 文件 ${time(data.mtime)} · SHA256 ${data.hash}。证据内容是此刻文件；不属于先前图快照的原子内容。`;
    },
  );
}
const polling = new AutoRefresh(() => refresh.refresh());
try { polling.enabled = localStorage.getItem("delivery-board.auto-refresh") !== "off"; } catch {}
$("auto-refresh").checked = polling.enabled;
$("auto-refresh").onchange = e => {
  polling.setEnabled(e.target.checked);
  try { localStorage.setItem("delivery-board.auto-refresh", e.target.checked ? "on" : "off"); } catch {}
};
document.addEventListener("visibilitychange", () => polling.setVisible(!document.hidden));
$("refresh").onclick = () => {
  $("refresh").textContent = "↻ 读取中…";
  polling.refreshNow();
};
$("fit").onclick = () => canvas.fit();
$("zoom-in").onclick = () => canvas.zoom(1.25);
$("zoom-out").onclick = () => canvas.zoom(0.8);
$("search").oninput = (e) => {
  state.search = e.target.value;
  if (state.graph) renderGraph(true);
};
$("search").onkeydown = (e) => {
  if (e.key === "Enter") $("node-list").querySelector("button")?.click();
};
$("expand-all").onclick = () => {
  if (!state.graph) return;
  state.expanded =
    state.expanded.size === state.graph.groups.length
      ? new Set()
      : new Set(state.graph.groups.map((g) => g.id));
  renderNav();
  renderGraph(false);
};
$("clear-focus").onclick = () => {
  state.focus = null;
  $("clear-focus").hidden = true;
  renderGraph(true);
};
polling.visible = !document.hidden;
polling.start();
