import { analyze, closure, hasOwnBlocker } from "./model.js";

// Derive context from a normalized graph without changing its recorded edges.
export function currentWork(graph) {
  const analysis = analyze(graph);
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const milestones = graph.nodes.filter((node) => node.kind === "milestone");

  function contains(milestone, targetId) {
    const pending = [...(milestone.children || [])];
    const visited = new Set([milestone.id]);
    while (pending.length) {
      const id = pending.pop();
      if (id === targetId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      const child = nodes.get(id);
      if (child?.kind === "milestone") pending.push(...(child.children || []));
    }
    return false;
  }

  return graph.nodes
    .filter((node) => node.status === "in_progress")
    .map((node) => {
      const journeys = (graph.journeys || []).filter((journey) =>
        journey.itemIds.includes(node.id),
      );
      const journeyIds = new Set(journeys.map((journey) => journey.id));
      for (const journey of node.journeys || []) {
        if (journeyIds.has(journey.id)) continue;
        journeys.push(journey);
        journeyIds.add(journey.id);
      }
      const descendants = closure(graph, [node.id], "descendants");
      return {
        node,
        group: graph.groups.find((group) => group.id === node.groupId),
        journeys,
        scopeMilestones: milestones.filter(
          (milestone) => milestone.id !== node.id && contains(milestone, node.id),
        ),
        downstreamMilestones: milestones.filter(
          (milestone) => milestone.id !== node.id && descendants.has(milestone.id),
        ),
        unmet: analysis[node.id].unmet,
        successors: graph.nodes.filter((successor) =>
          successor.dependsOn.includes(node.id),
        ),
        blockedBy: analysis[node.id].blockedBy,
        hasOwnBlocker: hasOwnBlocker(node),
      };
    });
}
