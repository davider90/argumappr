import { Edge, Graph } from "graphlib";
import { RankTable } from "./utils";

type NodeId = string;
type EdgeString = string;
type Direction = "up" | "down";

export default function layerNodes(graph: Graph) {
  const { tree: feasibleTree, ranks } = getFeasibleTree(graph);
  let negativeCutValueEdge = getNegativeCutValueEdge(feasibleTree);

  while (!!negativeCutValueEdge) {
    const nontreeMinSlackEdge = getNontreeMinSlackEdge(
      graph,
      feasibleTree,
      negativeCutValueEdge
    );

    feasibleTree.removeEdge(negativeCutValueEdge);
    feasibleTree.setEdge(nontreeMinSlackEdge);
    setCutValue(feasibleTree, ranks, nontreeMinSlackEdge);

    negativeCutValueEdge = getNegativeCutValueEdge(feasibleTree);
  }
  // normalize(tree, ranks);
  // balance(graph);
  return [];
}

export function getFeasibleTree(graph: Graph) {
  const ranks = initializeRanks(graph);
  const tree = getTightTree(graph, ranks);
  const minSlackGetter = () => {};

  while (tree.nodeCount() < graph.nodeCount()) {
    const { minSlackEdge, minSlack } = getMinSlackEdge(graph, tree, ranks);
    let slack = minSlack;

    if (tree.hasNode(minSlackEdge.v)) slack = -slack;

    for (const node of tree.nodes()) {
      const newRank = ranks.get(node)! + slack;
      ranks.set(node, newRank);
    }
  }

  tree.edges().forEach((edge) => {
    setCutValue(tree, ranks, edge);
  });

  return { tree, ranks };
}

export function initializeRanks(graph: Graph) {
  const nodes: NodeId[] = [...graph.nodes()];
  const ranks = new RankTable();

  while (nodes.length > 0) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const inEdges = graph.inEdges(node) || [];

      if (inEdges.length === 0) {
        ranks.set(node, 0);
        nodes.splice(i, 1);
        i--;
      } else {
        const parents = inEdges.map((e) => e.v);
        let maxParentRank = -Infinity;

        for (let j = 0; j < parents.length; j++) {
          const parent = parents[j];
          const parentRank = ranks.getByNode(parent);

          if (parentRank === undefined) {
            maxParentRank = -Infinity;
            break;
          }

          if (parentRank > maxParentRank) maxParentRank = parentRank;
        }

        if (maxParentRank !== -Infinity) {
          ranks.set(node, maxParentRank + 1);
          nodes.splice(i, 1);
          i--;
        }
      }
    }
  }

  return ranks;
}

export function getTightTree(graph: Graph, ranks: RankTable) {
  if (graph.nodeCount() === 0 || ranks.size === 0) return new Graph();

  const tightTree = new Graph();

  graph.setNode("dummyRootNode");
  ranks.getByRank(0)!.forEach((node) => {
    graph.setEdge("dummyRootNode", node);
  });
  ranks.set("dummyRootNode", -1);

  visitTightTreeNode(graph, ranks, tightTree, "dummyRootNote", 1);

  graph.removeNode("dummyRootNode"); // Edges are implicitly removed

  return tightTree;
}

export function visitTightTreeNode(
  graph: Graph,
  ranks: RankTable,
  tightTree: Graph,
  node: NodeId,
  number: number
) {
  const outEdges = graph.outEdges(node);
  let lastChildNumber = number;

  if (!!outEdges) {
    outEdges.forEach((outEdge) => {
      const { v, w } = outEdge;
      const rankDistance = ranks.getByNode(w)! - ranks.getByNode(v)!;

      if (rankDistance === 1) {
        lastChildNumber = visitTightTreeNode(
          graph,
          ranks,
          tightTree,
          node,
          lastChildNumber
        );

        tightTree.setEdge(v, w);
      }
    });
  } else {
    tightTree.setNode(node, {
      number,
      minSubtreeNumber: number,
    });

    return number + 1;
  }

  const nodeNumber = lastChildNumber + 1;

  tightTree.setNode(node, {
    number: nodeNumber,
    minSubtreeNumber: number,
  });

  return nodeNumber;
}

export function iterateMinSlackEdges(
  graph: Graph,
  tree: Graph,
  ranks: RankTable
) {
  const viableEdges = graph.edges().filter((edge) => {
    const { v, w } = edge;

    return !tree.hasEdge(edge) && (!tree.hasNode(v) || !tree.hasNode(w));
  });
  let currentIndex = 0;

  viableEdges.sort((edge0, edge1) => {
    const { v: v0, w: w0 } = edge0;
    const { v: v1, w: w1 } = edge1;
    const slack0 = ranks.getByNode(w0)! - ranks.getByNode(v0)! - 1;
    const slack1 = ranks.getByNode(w1)! - ranks.getByNode(v1)! - 1;

    if (slack0 < slack1) return -1;
    if (slack0 > slack1) return 1;
    return 0;
  });

  let minSlackEdge: Edge = { v: "", w: "" };
  let minSlack = Infinity;

  for (const edge of graph.edges()) {
    const { v, w } = edge;

    if (tree.hasEdge(edge) || (tree.hasNode(v) && tree.hasNode(w))) continue;

    const slack = ranks.getByNode(w)! - ranks.getByNode(v)! - 1;

    if (slack < minSlack) {
      minSlack = slack;
      minSlackEdge = edge;
    }
  }

  return { minSlackEdge, minSlack };
}

export function setCutValue(
  tree: Graph,
  ranks: Map<NodeId, number>,
  edge: Edge
) {
  const { v, w } = edge;
  const vRank = ranks.get(v)!;
  const wRank = ranks.get(w)!;
  let tailDirection: Direction;
  let headDirection: Direction;
  let cutValue = 1;

  if (vRank < wRank) {
    tailDirection = "up";
    headDirection = "down";
  } else {
    tailDirection = "down";
    headDirection = "up";
  }

  const tailComponent = getRankConstrainedComponent(
    tree,
    v,
    ranks,
    tailDirection
  );
  const headComponent = getRankConstrainedComponent(
    tree,
    w,
    ranks,
    headDirection
  );
  const { incidentEdges: tailIncidentEdges } = tailComponent;
  const { nodes: headNodes } = headComponent;

  tailIncidentEdges.delete(`${v} -> ${w}`);

  for (const tailIncidentEdge of tailIncidentEdges) {
    const { v: otherV, w: otherW } = readEdgeString(tailIncidentEdge);

    if (headNodes.has(otherW)) {
      cutValue++;
    } else if (headNodes.has(otherV)) {
      cutValue--;
    }
  }

  tree.setEdge(v, w, { cutValue, tailComponent, headComponent });
}

export function stringifyNodeEdges(graph: Graph, node: NodeId) {
  const outEdges = graph.outEdges(node) || [];
  const inEdges = graph.inEdges(node) || [];
  const edges = [...outEdges, ...inEdges];

  return edges.map((edge) => `${edge.v} -> ${edge.w}`);
}

export function readEdgeString(edgeString: string) {
  const [v, w] = edgeString.split(" -> ");
  return { v, w };
}

export function getNegativeCutValueEdge(tree: Graph) {
  tree.edges().forEach((edge) => {
    const cutValue = tree.edge(edge)!.cutValue;

    if (cutValue < 0) return edge;
  });

  return undefined;
}

export function getNontreeMinSlackEdge(
  graph: Graph,
  tree: Graph,
  cutEdge: Edge
) {
  const { tailComponent, headComponent } = tree.edge(cutEdge)!;
  let nontreeMinSlackEdge: Edge = { v: "", w: "" };
  let nontreeMinSlack = Infinity;

  graph.edges().forEach((edge) => {
    const { v: otherV, w: otherW } = edge;
    const vInHeadComponent = headComponent.nodes.has(otherV);
    const wInTailComponent = tailComponent.nodes.has(otherW);
    const edgeCutValue = tree.edge(edge)!.cutValue;

    if (
      vInHeadComponent &&
      wInTailComponent &&
      edgeCutValue < nontreeMinSlack &&
      !tree.hasEdge(edge)
    ) {
      nontreeMinSlackEdge = edge;
      nontreeMinSlack = edgeCutValue;
    }
  });

  return nontreeMinSlackEdge;
}

export function getRankConstrainedComponent(
  tree: Graph,
  baseNode: NodeId,
  ranks: Map<NodeId, number>,
  direction: Direction
) {
  const baseNodeRank = ranks.get(baseNode)!;
  const baseNodeEdges = stringifyNodeEdges(tree, baseNode);
  const componentEdges = new Set<EdgeString>(baseNodeEdges);
  const componentNodes = new Set<NodeId>(baseNode);
  const componentIncidentEdges = new Set<EdgeString>();

  for (const edge of componentEdges) {
    const { v, w } = readEdgeString(edge);
    const nextNode = componentNodes.has(v) ? w : v;
    const nextNodeRank = ranks.get(nextNode)!;

    if (
      (direction === "up" && nextNodeRank <= baseNodeRank) ||
      (direction === "down" && nextNodeRank >= baseNodeRank)
    ) {
      const nextEdges = stringifyNodeEdges(tree, nextNode);

      nextEdges.forEach((edge) => componentEdges.add(edge));
      componentNodes.add(nextNode);
    } else {
      componentIncidentEdges.add(edge);
    }
  }

  const component: {
    nodes: Set<NodeId>;
    incidentEdges: Set<EdgeString>;
  } = {
    nodes: componentNodes,
    incidentEdges: componentIncidentEdges,
  };

  return component;
}
