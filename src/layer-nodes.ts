import { Edge, Graph } from "graphlib";
import { NodeId, RankTable } from "./utils";

const MAX_LOOPS = 100;

/**
 * Assigns all nodes of the input graph to optimal ranks and returns the layers.
 * The algorithm is based on Gansner et al.'s network simplex algorithm.
 *
 * @remarks Non-proven polynomial run time and "fast in practice".
 *
 * @param graph A graphlib graph object. Must be directed.
 * @returns A rank table.
 */
export default function layerNodes(graph: Graph) {
  const conjunctNodes = mergeConjunctNodes(graph);
  const treeAndRanks = getFeasibleTree(graph);
  const { tree } = treeAndRanks;
  let { ranks } = treeAndRanks;
  const negativeEdgeIterator = new NegativeCutValueEdgeIterator(tree);
  let loopCount = 0;

  while (negativeEdgeIterator.hasNext() && loopCount < MAX_LOOPS) {
    const negativeEdge = negativeEdgeIterator.next()!;
    const minSlackEdge = getNontreeMinSlackEdge(
      graph,
      tree,
      ranks,
      negativeEdge
    )!;

    if (minSlackEdge === null) break;

    tree.removeEdge(negativeEdge);
    tree.setEdge(minSlackEdge);
    ranks = updateTreeValues(graph, tree, ranks, minSlackEdge);

    loopCount++;
  }

  normalize(graph, ranks);
  balance(graph, ranks);
  splitConjunctNodes(graph, conjunctNodes);

  return ranks;
}

export function mergeConjunctNodes(graph: Graph) {
  const conjunctNodes = graph
    .nodes()
    .filter((node) => graph.node(node).isConjunctNode);

  conjunctNodes.forEach((node) => {
    const originalEdges: Edge[] = [];
    const subnodeData: { [node: NodeId]: any } = {};
    const subnodes = graph.children(node);

    subnodes.forEach((subnode) => {
      const inEdges = graph.inEdges(subnode) || [];
      const outEdges = graph.outEdges(subnode) || [];

      inEdges.forEach((inEdge) => {
        const { v } = inEdge;
        graph.setEdge(v, node);
        originalEdges.push(inEdge);
      });

      outEdges.forEach((outEdge) => {
        const { w } = outEdge;
        graph.setEdge(node, w);
        originalEdges.push(outEdge);
      });

      subnodeData[subnode] = graph.node(subnode);
      graph.removeNode(subnode);
    });

    graph.node(node).subnodeData = subnodeData;
    graph.node(node).originalEdges = originalEdges;
  });

  return conjunctNodes;
}

export function splitConjunctNodes(graph: Graph, conjunctNodes: NodeId[]) {
  conjunctNodes.forEach((node) => {
    const subnodeData = graph.node(node).subnodeData;
    const originalEdges = graph.node(node).originalEdges;

    Object.keys(subnodeData).forEach((subnode) => {
      graph.setNode(subnode, subnodeData[subnode]);
      graph.setParent(subnode, node);
    });

    originalEdges.forEach((edge) => {
      graph.setEdge(edge);
    });

    graph.nodeEdges(node)!.forEach((edge) => {
      graph.removeEdge(edge);
    });
  });
}

export function balance(graph: Graph, ranks: RankTable) {
  graph.nodes().forEach((node) => {
    const inDegree = (graph.inEdges(node) || []).length;
    const outDegree = (graph.outEdges(node) || []).length;

    if (inDegree === outDegree) {
      const parentsRanks = (graph.predecessors(node) || []).map(
        (parent) => ranks.getRankNumber(parent)!
      );
      const childrenRanks = (graph.successors(node) || []).map(
        (child) => ranks.getRankNumber(child)!
      );
      const maxParentRank = Math.max(...parentsRanks);
      const minChildRank = Math.min(...childrenRanks);

      if (minChildRank - maxParentRank > 2) {
        const startRankNumber = parentsRanks.length > 0 ? maxParentRank + 1 : 0;
        const endRankNumber =
          childrenRanks.length > 0 ? minChildRank - 1 : ranks.getLargestRank();
        let smallestFeasibleRankNumber = ranks.getRankNumber(node)!;
        let smallestFeasibleRankSize = ranks.getRankNodes(
          smallestFeasibleRankNumber
        )!.size;

        for (let i = startRankNumber; i <= endRankNumber; i++) {
          const iRankSize = ranks.getRankNodes(i)!.size;

          if (iRankSize < smallestFeasibleRankSize) {
            smallestFeasibleRankNumber = i;
            smallestFeasibleRankSize = iRankSize;
          }
        }

        ranks.set(node, smallestFeasibleRankNumber);
      }
    }
  });
}

export function normalize(graph: Graph, ranks: RankTable) {
  const smallestRank = ranks.getSmallestRank();

  graph.nodes().forEach((node) => {
    const rank = ranks.getRankNumber(node)!;
    ranks.set(node, rank + smallestRank);
    graph.node(node).y = rank + smallestRank + 5;
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
    setCutValues(graph, tree);
    return newRanks;
  }

  updateRanks(tree, ranks, commonAncestor);

  const { number, minSubtreeNumber } = tree.node(commonAncestor)!;
  const stack: NodeId[] = tree.neighbors(commonAncestor)!.filter((neighbor) => {
    return number < tree.node(neighbor)!.number;
  });

  postorderNumber(tree, commonAncestor, stack, minSubtreeNumber);
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
  if (graph.edgeCount() === 0) return { tree, ranks };

  while (tree.nodeCount() < graph.nodeCount()) {
    const { minSlackEdge, minSlack } = getMinSlack(graph, tree, ranks);
    if (minSlackEdge === null) break;
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

  setCutValues(graph, tree);

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

    if (tightTree.hasNode(v) && tightTree.hasNode(w)) continue;

    const rankDistance = Math.abs(
      ranks.getRankNumber(v)! - ranks.getRankNumber(w)!
    );

    if (rankDistance === 1) {
      const newNode = tightTree.hasNode(v) ? w : v;
      const newEdges = graph.nodeEdges(newNode)!;

      tightTree.setNode(newNode);
      tightTree.setEdge(edge);
      edges.push(...newEdges);
    }
  }

  return tightTree;
}

export function setCutValues(graph: Graph, tree: Graph) {
  const rootNode = graph.nodes()[0];
  const stack: NodeId[] = [];

  postorderNumber(tree, rootNode, stack, 1);
  postorderSetCutValues(graph, tree, rootNode, stack);
}

export function postorderNumber(
  tree: Graph,
  node: NodeId,
  stack: NodeId[],
  number: number
) {
  stack.push(node);

  const neighbors = tree.neighbors(node) || [];
  let nextNumber = number;

  neighbors.forEach((neighbor) => {
    if (!stack.includes(neighbor))
      nextNumber = postorderNumber(tree, neighbor, stack, nextNumber);
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
    const connectedNodeType = getConnectedNode(node, parentEdge).nodeType;
    const predecessors = graph.predecessors(node) || [];
    const successors = graph.successors(node) || [];

    if (connectedNodeType === "tail") {
      cutValue = predecessors.length - successors.length;
    } else {
      cutValue = successors.length - predecessors.length;
    }
  } else {
    const neighbors = tree.neighbors(node)!;

    neighbors.forEach((neighbor) => {
      if (!stack.includes(neighbor))
        postorderSetCutValues(graph, tree, neighbor, stack);
    });

    parentEdge = treeEdges.find(
      (edge) => tree.edge(edge)?.cutValue === undefined
    );

    if (parentEdge === undefined) {
      stack.pop();
      return;
    }

    const parentNodeType = getConnectedNode(node, parentEdge).nodeType;

    graph.nodeEdges(node)!.forEach((edge) => {
      const connectedNodeType = getConnectedNode(node, edge).nodeType;
      const edgeCutValue = tree.edge(edge)?.cutValue;

      if (edgeCutValue) {
        cutValue += edgeCutValue - 1;
      } else if (connectedNodeType === parentNodeType) {
        cutValue++;
      } else {
        cutValue--;
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
    if (this.index === this.tree.edgeCount()) return false;

    const edge = this.tree.edges()[this.index];
    const cutValue = this.tree.edge(edge)!.cutValue;

    return cutValue < 0;
  }

  hasNext() {
    if (this.tree.edgeCount() === 0) return false;

    const startIndex = this.index;

    while (!this.checkCutValue()) {
      this.index = (this.index + 1) % this.tree.edgeCount();
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
  ranks: RankTable,
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
    if (tree.hasEdge(edge)) continue;

    const { v: otherV, w: otherW } = edge;
    const edgeSlack = Math.abs(
      ranks.getRankNumber(otherV)! - ranks.getRankNumber(otherW)!
    );
    const vInHeadComponent = !checkNodeInTail(otherV);
    const wInTailComponent = checkNodeInTail(otherW);

    if (vInHeadComponent && wInTailComponent && edgeSlack < minSlack) {
      minSlackEdge = edge;
      minSlack = edgeSlack;
    }
  }

  return minSlackEdge;
}
