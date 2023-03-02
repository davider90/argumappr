import { Edge, Graph } from "graphlib";
import { RankTable } from "./utils";

type NodeId = string;

export default function layerNodes(graph: Graph) {
  const treeAndRanks = getFeasibleTree(graph);
  const { tree } = treeAndRanks;
  let { ranks } = treeAndRanks;
  const negativeEdgeIterator = new NegativeCutValueEdgeIterator(tree);

  while (negativeEdgeIterator.hasNext()) {
    const negativeEdge = negativeEdgeIterator.next()!;
    const minSlackEdge = getNontreeMinSlackEdge(graph, tree, negativeEdge)!;

    tree.removeEdge(negativeEdge);
    tree.setEdge(minSlackEdge);
    ranks = updateTreeValues(graph, tree, ranks, minSlackEdge);
  }
  normalize(tree, ranks);
  // balance(graph);
  return ranks;
}

export function normalize(tree: Graph, ranks: RankTable) {
  const smallestRank = ranks.getSmallestRank();

  tree.nodes().forEach((node) => {
    const rank = ranks.getRankNumber(node)!;
    ranks.set(node, rank + smallestRank);
  });
}

export function updateTreeValues(
  graph: Graph,
  tree: Graph,
  ranks: RankTable,
  minSlackEdge: Edge
) {
  const rootNode = graph.nodes()[0];
  const { v, w } = minSlackEdge;
  const commonAncestor = getClosestCommonAncestor(tree, v, w)!;

  if (commonAncestor === rootNode) {
    const newRanks = setRanks(tree);
    setCutValues(graph, tree, newRanks);
    return newRanks;
  }

  updateRanks(tree, ranks, commonAncestor);

  const { number, minSubtreeNumber } = tree.node(commonAncestor)!;
  const stack: NodeId[] = tree.neighbors(commonAncestor)!.filter((neighbor) => {
    return number < tree.node(neighbor)!.number;
  });

  postorderNumber(tree, ranks, commonAncestor, stack, minSubtreeNumber);
  postorderSetCutValues(graph, tree, commonAncestor, stack);

  return ranks;
}

export function updateRanks(
  tree: Graph,
  ranks: RankTable,
  commonAncestor: NodeId
) {
  const ancestorNumber = tree.node(commonAncestor)!.number;
  const subtreeNodes: NodeId[] = tree
    .neighbors(commonAncestor)!
    .filter((neighbor) => {
      const neighborNumber = tree.node(neighbor)!.number;
      return neighborNumber < ancestorNumber;
    });

  for (const node of subtreeNodes) {
    const nodeNumber = tree.node(node)!.number;

    tree.neighbors(node)!.forEach((neighbor) => {
      const neighborNumber = tree.node(neighbor)!.number;
      if (neighborNumber < nodeNumber) subtreeNodes.push(neighbor);
    });
  }

  const newRanks = setRanks(tree, subtreeNodes);

  subtreeNodes.forEach((node) => {
    ranks.set(node, newRanks.getRankNumber(node)!);
  });
}

export function getClosestCommonAncestor(
  tree: Graph,
  node0: NodeId,
  node1: NodeId
) {
  const { number: node0Number } = tree.node(node0)!;
  const { number: node1Number } = tree.node(node1)!;
  const lowestNumber = Math.min(node0Number, node1Number);
  const highestNumber = Math.max(node0Number, node1Number);
  const nodes = tree.neighbors(node0)!;

  for (const node of nodes) {
    const { number, minSubtreeNumber } = tree.node(node)!;

    if (minSubtreeNumber <= highestNumber && lowestNumber <= number)
      return node;

    tree.neighbors(node)!.forEach((neighbor) => {
      if (!nodes.includes(neighbor)) nodes.push(neighbor);
    });
  }
}

export function getFeasibleTree(graph: Graph) {
  const ranks = setRanks(graph);
  const tree = getTightTree(graph, ranks);

  while (tree.nodeCount() < graph.nodeCount()) {
    const { minSlackEdge, minSlack } = getMinSlack(graph, tree, ranks);
    const { v, w } = minSlackEdge!;
    let delta: number;
    let newNode: NodeId;

    if (tree.hasNode(v)) {
      delta = minSlack;
      newNode = w;
    } else {
      delta = -minSlack;
      newNode = v;
    }

    tree.setNode(newNode);
    tree.setEdge(minSlackEdge!);

    for (const node of graph.nodes()) {
      if (node === newNode) continue;
      const newRank = ranks.getRankNumber(node)! + delta;
      ranks.set(node, newRank);
    }
  }

  setCutValues(graph, tree, ranks);

  return { tree, ranks };
}

export function setRanks(graph: Graph, nodeList?: NodeId[]) {
  const nodes = nodeList || graph.nodes();
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
          const parentRank = ranks.getRankNumber(parent);

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
  if (graph.nodeCount() === 0) return new Graph();

  const tightTree = new Graph();
  const node = graph.nodes()[0];
  const edges = graph.nodeEdges(node) || [];

  tightTree.setNode(node);

  for (const edge of edges) {
    const { v, w } = edge;
    const rankDistance = Math.abs(
      ranks.getRankNumber(v)! - ranks.getRankNumber(w)!
    );

    if (rankDistance === 1) {
      const newNode = tightTree.hasNode(v) ? w : v;
      const newEdges = graph.nodeEdges(newNode)!;

      tightTree.setNode(newNode);
      tightTree.setEdge(edge);
      newEdges.forEach((newEdge) => {
        const { v: newV, w: newW } = newEdge;

        if (!tightTree.hasNode(newV) || !tightTree.hasNode(newW))
          edges.push(newEdge);
      });
    }
  }

  return tightTree;
}

export function setCutValues(graph: Graph, tree: Graph, ranks: RankTable) {
  const rootNode = graph.nodes()[0];
  const stack: NodeId[] = [];

  postorderNumber(tree, ranks, rootNode, stack, 1);
  postorderSetCutValues(graph, tree, rootNode, stack);
}

export function postorderNumber(
  tree: Graph,
  ranks: RankTable,
  node: NodeId,
  stack: NodeId[],
  number: number
) {
  stack.push(node);

  const neighbors = tree.neighbors(node) || [];
  let nextNumber = number;

  neighbors.forEach((neighbor) => {
    if (!stack.includes(neighbor))
      nextNumber = postorderNumber(tree, ranks, neighbor, stack, nextNumber);
  });

  tree.setNode(node, {
    number: nextNumber,
    minSubtreeNumber: number,
  });

  stack.pop();

  return nextNumber + 1;
}

export function postorderSetCutValues(
  graph: Graph,
  tree: Graph,
  node: NodeId,
  stack: NodeId[]
) {
  stack.push(node);

  const { number, minSubtreeNumber } = tree.node(node)!;
  const isLeafNode = number === minSubtreeNumber;
  const treeEdges = tree.nodeEdges(node) || [];
  let parentEdge: Edge | undefined;
  let cutValue = 0;

  if (treeEdges.length === 0) {
    stack.pop();
    return;
  }

  if (isLeafNode) {
    parentEdge = treeEdges[0];
    const predecessors = graph.predecessors(node) || [];
    const successors = graph.successors(node) || [];
    cutValue = predecessors.length - successors.length;
  } else {
    const neighbors = tree.neighbors(node)!;

    neighbors.forEach((neighbor) => {
      if (!stack.includes(neighbor))
        postorderSetCutValues(graph, tree, neighbor, stack);
    });

    parentEdge = treeEdges.find(
      (edge) => tree.edge(edge).cutValue === undefined
    );

    if (parentEdge === undefined) {
      stack.pop();
      return;
    }

    graph.nodeEdges(node)!.forEach((edge) => {
      const connectedNodeType = getConnectedNode(node, edge).nodeType;
      const edgeCutValue = graph.edge(edge).cutValue;
      const delta = !!edgeCutValue ? edgeCutValue - 1 : 1;

      if (connectedNodeType === "tail") {
        cutValue += delta;
      } else {
        cutValue -= delta;
      }
    });
  }

  tree.setEdge(parentEdge, { cutValue });

  stack.pop();
}

type ConnectedNodeType = "tail" | "head";

export function getConnectedNode(
  node: NodeId,
  edge: Edge
): { node: NodeId; nodeType: ConnectedNodeType } {
  const { v, w } = edge;

  if (node === v) return { node: w, nodeType: "head" };
  return { node: v, nodeType: "tail" };
}

export function getMinSlack(graph: Graph, tree: Graph, ranks: RankTable) {
  let minSlackEdge: Edge | null = null;
  let minSlack = Infinity;

  for (const edge of graph.edges()) {
    const { v, w } = edge;

    if (tree.hasNode(v) && tree.hasNode(w)) continue;

    const rankDistance = Math.abs(
      ranks.getRankNumber(v)! - ranks.getRankNumber(w)!
    );
    const slack = rankDistance - 1;

    if (slack < minSlack) {
      minSlackEdge = edge;
      minSlack = slack;
    }
  }

  return { minSlackEdge, minSlack };
}

export class NegativeCutValueEdgeIterator {
  private tree: Graph;
  private index: number;

  constructor(tree: Graph) {
    this.tree = tree;
    this.index = 0;
    this.hasNext = this.hasNext.bind(this);
    this.next = this.next.bind(this);
  }

  private checkCutValue() {
    if (this.index === this.tree.edges().length) return false;

    const edge = this.tree.edges()[this.index];
    const cutValue = this.tree.edge(edge)!.cutValue;

    return cutValue < 0;
  }

  hasNext() {
    const startIndex = this.index;

    while (!this.checkCutValue()) {
      this.index = (this.index + 1) % this.tree.edges().length;
      if (this.index === startIndex) return false;
    }

    return true;
  }

  next() {
    if (this.hasNext()) {
      const edge = this.tree.edges()[this.index];
      return edge;
    }

    return null;
  }
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
  const { v, w } = cutEdge;
  const { number: vNumber, minSubtreeNumber: vMinSubtreeNumber } =
    tree.node(v)!;
  const { number: wNumber, minSubtreeNumber: wMinSubtreeNumber } =
    tree.node(w)!;
  const rootNodeInHead = vNumber < wNumber;
  let checkNodeInTail: (node: NodeId) => boolean;
  let minSlackEdge: Edge | null = null;
  let minSlack = Infinity;

  if (rootNodeInHead) {
    checkNodeInTail = (node) => {
      const nodeNumber = tree.node(node)!.number;
      return vMinSubtreeNumber <= nodeNumber && nodeNumber <= vNumber;
    };
  } else {
    checkNodeInTail = (node) => {
      const nodeNumber = tree.node(node)!.number;
      return wMinSubtreeNumber <= nodeNumber && nodeNumber <= wNumber;
    };
  }

  for (const edge of graph.edges()) {
    const edgeCutValue = tree.edge(edge)!.cutValue;

    if (tree.hasEdge(edge) || edgeCutValue >= minSlack) continue;

    const { v: otherV, w: otherW } = edge;
    const vInHeadComponent = !checkNodeInTail(otherV);
    const wInTailComponent = checkNodeInTail(otherW);

    if (vInHeadComponent && wInTailComponent) {
      minSlackEdge = edge;
      minSlack = edgeCutValue;
    }
  }

  return minSlackEdge;
}
