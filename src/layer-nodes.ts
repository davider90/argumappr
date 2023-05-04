import { Edge } from "graphlib";
import Graph from "./graph";
import { EdgeAndLabel, NODE_Y_SPACING, NodeId, RankTable } from "./utils";

/**
 * Assigns all nodes of the input graph to optimal ranks, gives them
 * *y*-coordinates based on their layer and returns the layers.
 *
 * @remarks
 * This algorithm is based on Gansner et al.'s network simplex algorithm. It
 * calculates a feasible tree and then iteratively improves it by moving nodes
 * based on the cut values of their edges. The results are optimal. The
 * algorithm has a non-proven (assumed) polynomial run time and is reported to
 * be fast in practice.
 *
 * @see
 * [A technique for drawing directed graphs](https://ieeexplore.ieee.org/document/221135)
 *
 * @param graph A graph object. Must be directed and acyclic.
 * @returns A rank table.
 */
export default function layerNodes(graph: Graph) {
  const conjunctNodes = mergeConjunctNodes(graph);
  const metaRelevanceNodes = mergeRelevanceStructures(graph);
  const treeAndRanks = getFeasibleTree(graph);
  const { tree } = treeAndRanks;
  let { ranks } = treeAndRanks;
  const edgeIterator = new NegativeCutValueEdgeIterator(tree);
  let loopCount = 0;

  while (edgeIterator.hasNext() && loopCount < graph.graph().maxrankingloops) {
    loopCount++;

    const treeEdge = edgeIterator.next()!;
    const nontreeEdge = getNontreeMinSlackEdge(graph, tree, ranks, treeEdge);

    if (!nontreeEdge) continue;

    tree.removeEdge(treeEdge);
    tree.setEdge(nontreeEdge, graph.edge(nontreeEdge));
    ranks = updateTreeValues(graph, tree, ranks, nontreeEdge);
  }

  normalizeRanks(graph, ranks);
  balanceLayering(graph, ranks);
  splitRelevanceStructures(graph, ranks, metaRelevanceNodes);
  splitConjunctNodes(graph, ranks, conjunctNodes);
  setYCoordinates(graph, ranks);

  return ranks;
}

/**
 * Merges the subnodes of conjunct nodes into a single node with all inedges
 * and outedges of the subnodes. Stores away any labels for later restoration.
 *
 * @param graph A graph object.
 * @returns The conjunct nodes.
 */
function mergeConjunctNodes(graph: Graph) {
  const conjunctNodes = graph
    .nodes()
    .filter((node) => graph.node(node).isConjunctNode);

  conjunctNodes.forEach((node) => {
    const originalEdges: EdgeAndLabel[] = [];
    const subnodeData: { [node: NodeId]: any } = {};
    const subnodes = graph.children(node);

    subnodes.forEach((subnode) => {
      const inEdges = graph.inEdges(subnode) || [];
      const outEdges = graph.outEdges(subnode) || [];

      inEdges.forEach((inEdge) => {
        const { v } = inEdge;
        const edgeLabel = graph.edge(inEdge);

        graph.setEdge(v, node, edgeLabel);
        originalEdges.push({ ...inEdge, label: edgeLabel });
      });

      outEdges.forEach((outEdge) => {
        const { w } = outEdge;
        const edgeLabel = graph.edge(outEdge);

        graph.setEdge(node, w, edgeLabel);
        originalEdges.push({ ...outEdge, label: edgeLabel });
      });

      subnodeData[subnode] = graph.node(subnode);
      graph.removeNode(subnode);
    });

    graph.node(node).subnodeData = subnodeData;
    graph.node(node).originalEdges = originalEdges;
  });

  return conjunctNodes;
}

/**
 * Merges relevance structures into a single node with all inedges and outedges
 * of the subnodes. Stores away any labels for later restoration. Returns the
 * meta relevance nodes.
 *
 * @param graph A grapb object.
 * @returns The meta relevance nodes.
 */
function mergeRelevanceStructures(graph: Graph) {
  const metaRelevanceNodes: NodeId[] = [];
  const relevanceSinks = graph
    .nodes()
    .filter((node) => graph.node(node).isRelevanceSink);

  relevanceSinks.forEach((sink) => {
    const originalEdges: EdgeAndLabel[] = [];
    const subnodeData: { [node: NodeId]: any } = {};
    const incidentNodes = sink.split(" -> ");
    const relevanceSource = graph.predecessors(sink)![0];
    const nodes = [sink, ...incidentNodes, relevanceSource];
    const metaRelevanceNode = `meta ${sink}`;

    graph.setNode(metaRelevanceNode, {});

    nodes.forEach((node) => {
      const inEdges = graph.inEdges(node) || [];
      const outEdges = graph.outEdges(node) || [];

      for (const inEdge of inEdges) {
        const { v } = inEdge;
        const edgeLabel = graph.edge(inEdge);

        originalEdges.push({ ...inEdge, label: edgeLabel });
        if (nodes.includes(v)) continue;
        graph.setEdge(v, metaRelevanceNode, edgeLabel);
      }

      for (const outEdge of outEdges) {
        const { v, w } = outEdge;
        let edgeLabel = graph.edge(outEdge);

        originalEdges.push({ ...outEdge, label: edgeLabel });

        if (nodes.includes(w)) continue;

        if (incidentNodes[1] === v || relevanceSource === v)
          edgeLabel = { ...edgeLabel, minlen: edgeLabel.minlen + 1 };

        graph.setEdge(metaRelevanceNode, w, edgeLabel);
      }

      subnodeData[node] = graph.node(node);
      graph.removeNode(node);
    });

    graph.node(metaRelevanceNode).subnodeData = subnodeData;
    graph.node(metaRelevanceNode).originalEdges = originalEdges;
    metaRelevanceNodes.push(metaRelevanceNode);
  });

  return metaRelevanceNodes;
}

/**
 * Sets an initial rank to all nodes, constructs a tight tree, greedily grows
 * the tree till it spans all nodes, sets initial cut values for all edges and
 * returns the tree and the ranks.
 *
 * @param graph A graph object.
 * @returns The feasible tree and the ranks.
 */
function getFeasibleTree(graph: Graph) {
  const ranks = setRanks(graph);
  const tree = getTightTree(graph, ranks);

  if (graph.edgeCount() === 0) return { tree, ranks };

  while (tree.nodeCount() < graph.nodeCount()) {
    const { minSlack, minSlackEdge } = getMinSlack(graph, tree, ranks);
    const { v, w } = minSlackEdge;
    let rankDelta: number;
    let newNode: NodeId;

    if (tree.hasNode(v)) {
      rankDelta = minSlack;
      newNode = w;
    } else {
      rankDelta = -minSlack;
      newNode = v;
    }

    tree.setNode(newNode, graph.node(newNode));
    tree.setEdge(minSlackEdge, graph.edge(minSlackEdge));

    for (const node of graph.nodes()) {
      if (node === newNode) continue;
      const newRank = ranks.getRank(node)! + rankDelta;
      ranks.set(node, newRank);
    }
  }

  setCutValues(graph, tree);

  return { tree, ranks };
}

/**
 * Greedily sets initial ranks to nodes. If a list of nodes is provided, only
 * those nodes are ranked. Otherwise, all nodes are ranked. Returns the ranks.
 *
 * @param graph A graph object.
 * @param nodeList An optional list of nodes to rank.
 * @returns A rank table.
 */
function setRanks(graph: Graph, nodeList?: NodeId[]) {
  const nodes = nodeList || graph.nodes();
  const ranks = new RankTable();

  while (nodes.length > 0) {
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      const node = nodes[nodeIndex];
      const inEdges = graph.inEdges(node) || [];

      if (inEdges.length === 0) {
        ranks.set(node, 0);
        nodes.splice(nodeIndex, 1);
        nodeIndex--;
      } else {
        let maxParentRank = -Infinity;
        let edgeLength = -Infinity;

        for (const edge of inEdges) {
          const parent = edge.v;
          const parentRank = ranks.getRank(parent);
          const edgeMinLength: number = graph.edge(edge).minlen;

          if (parentRank === undefined) {
            maxParentRank = -Infinity;
            break;
          }

          if (maxParentRank + edgeLength < parentRank + edgeMinLength) {
            maxParentRank = parentRank;
            edgeLength = edgeMinLength;
          }
        }

        if (maxParentRank !== -Infinity) {
          ranks.set(node, maxParentRank + edgeLength);
          nodes.splice(nodeIndex, 1);
          nodeIndex--;
        }
      }
    }
  }

  return ranks;
}

/**
 * Constructs a tight tree for the given graph and ranks and returns it.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 * @returns A tight tree.
 */
function getTightTree(graph: Graph, ranks: RankTable) {
  if (graph.nodeCount() === 0) return new Graph();

  const tightTree = new Graph();
  const node = graph.nodes()[0];
  const edges = graph.nodeEdges(node) || [];

  tightTree.setNode(node, graph.node(node));

  for (const edge of edges) {
    const { v, w } = edge;

    if (tightTree.hasNode(v) && tightTree.hasNode(w)) continue;

    const edgeMinLength: number = graph.edge(edge).minlen;
    const rankDistance = ranks.getRank(w)! - ranks.getRank(v)!;
    const edgeIsTight = edgeMinLength === rankDistance;

    if (edgeIsTight) {
      const newNode = tightTree.hasNode(v) ? w : v;
      const newEdges = graph.nodeEdges(newNode)!;

      tightTree.setNode(newNode, graph.node(newNode));
      tightTree.setEdge(edge, graph.edge(edge));
      edges.push(...newEdges);
    }
  }

  return tightTree;
}

/**
 * Finds the smallest slack associated with an edge that connects a tree node
 * with a non-tree one. Returns the slack and the edge.
 *
 * @param graph A graph object.
 * @param tree A non-spanning tree.
 * @param ranks A rank table.
 * @returns The minimum slack and its associated edge.
 */
function getMinSlack(graph: Graph, tree: Graph, ranks: RankTable) {
  let minSlack = Infinity;
  let minSlackEdge: Edge = { v: "", w: "" };

  for (const edge of graph.edges()) {
    const { v, w } = edge;
    const hasReachableNewNode = tree.hasNode(v) !== tree.hasNode(w);

    if (!hasReachableNewNode) continue;

    const edgeMinLength: number = graph.edge(edge).minlen;
    const rankDistance = ranks.getRank(w)! - ranks.getRank(v)!;
    const slack = rankDistance - edgeMinLength;

    if (slack < minSlack) {
      minSlack = slack;
      minSlackEdge = edge;
    }
  }

  return { minSlack, minSlackEdge };
}

/**
 * Sets cut values for all edges in the tree. *Cut value* is defined as the sum
 * of weights of all edges going from the tail component to the head component
 * minus the sum of weights of all edges going the *other way*.
 *
 * @param graph A graph object.
 * @param tree A spanning tree.
 */
function setCutValues(graph: Graph, tree: Graph) {
  const rootNode = graph.nodes()[0];
  const nodeStack: NodeId[] = [];

  postorderNumber(tree, rootNode, nodeStack, 1);
  postorderSetCutValues(graph, tree, rootNode, nodeStack);
}

/**
 * Performs a postorder traversal of the tree and assigns nodes a postorder
 * number and the smallest postorder number in its subtrees.
 *
 * @param tree A spanning tree.
 * @param node The current node.
 * @param nodeStack Nodes on the current path.
 * @param number The current postorder number.
 * @returns The next postorder number.
 */
function postorderNumber(
  tree: Graph,
  node: NodeId,
  nodeStack: NodeId[],
  number: number
) {
  nodeStack.push(node);

  const neighbors = tree.neighbors(node) || [];
  let nextNumber = number;

  neighbors.forEach((neighbor) => {
    if (!nodeStack.includes(neighbor))
      nextNumber = postorderNumber(tree, neighbor, nodeStack, nextNumber);
  });

  tree.node(node).number = nextNumber;
  tree.node(node).minSubtreeNumber = nextNumber;

  nodeStack.pop();

  return nextNumber + 1;
}

/**
 * Assigns cut values to all tree edges in a postorder fashion. This is a more
 * efficient way to set cut values than the naive approach.
 *
 * @param graph A graph object.
 * @param tree A spanning tree.
 * @param node The current node.
 * @param nodeStack Nodes on the current path.
 */
function postorderSetCutValues(
  graph: Graph,
  tree: Graph,
  node: NodeId,
  nodeStack: NodeId[]
) {
  nodeStack.push(node);

  const { number, minSubtreeNumber } = tree.node(node);
  const isLeafNode = number === minSubtreeNumber;
  const treeEdges = tree.nodeEdges(node) || [];
  let parentEdge: Edge | undefined;
  let cutValue = 0;

  if (treeEdges.length === 0) {
    nodeStack.pop();
    return;
  }

  if (isLeafNode) {
    parentEdge = treeEdges[0];
    const parentIsTail = node === parentEdge.w;
    const predecessors = graph.predecessors(node) || [];
    const successors = graph.successors(node) || [];

    if (parentIsTail) {
      cutValue = predecessors.length - successors.length;
    } else {
      cutValue = successors.length - predecessors.length;
    }
  } else {
    const neighbors = tree.neighbors(node)!;

    neighbors.forEach((neighbor) => {
      if (!nodeStack.includes(neighbor))
        postorderSetCutValues(graph, tree, neighbor, nodeStack);
    });

    parentEdge = treeEdges.find(
      (edge) => tree.edge(edge)?.cutValue === undefined
    );

    if (parentEdge === undefined) {
      nodeStack.pop();
      return;
    }

    const parentNodeType = node === parentEdge.w ? "tail" : "head";

    graph.nodeEdges(node)!.forEach((edge) => {
      const connectedNodeType = node === edge.w ? "tail" : "head";
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

  tree.edge(parentEdge).cutValue = cutValue;

  nodeStack.pop();
}

/**
 * Provides an iterator for cyclically going through tree edges that have a
 * negative cut value.
 */
class NegativeCutValueEdgeIterator {
  private tree: Graph;
  private index: number;
  private lastEdge: Edge | undefined;

  constructor(tree: Graph) {
    this.tree = tree;
    this.index = 0;
    this.hasNext = this.hasNext.bind(this);
    this.next = this.next.bind(this);
  }

  /**
   * Checks if the current edge has a negative cut value and if it has already
   * been returned (implying that no non-tree edge was found to replace it).
   *
   * @returns Whether the edge at the current index can be returned.
   */
  private checkEdge() {
    if (this.index === this.tree.edgeCount()) return false;

    const edge = this.tree.edges()[this.index];

    if (this.lastEdge === edge) return false;
    return this.tree.edge(edge).cutValue < 0;
  }

  /**
   * Cyclically searches for a tree edge with a negative cut value.
   *
   * @returns Whether there is a tree edge that can be returned.
   */
  hasNext() {
    if (this.tree.edgeCount() === 0) return false;

    const startIndex = this.index;

    while (!this.checkEdge()) {
      this.index = (this.index + 1) % this.tree.edgeCount();
      if (this.index === startIndex) return false;
    }

    return true;
  }

  /**
   * Gets the next tree edge with a negative cut value. If `hasNext` returns
   * `false`, this method returns `null`.
   *
   * @returns The next tree edge with a negative cut value.
   */
  next() {
    if (!this.hasNext()) return null;

    const edge = this.tree.edges()[this.index];
    this.lastEdge = edge;

    return this.tree.edges()[this.index];
  }
}

/**
 * Searches for non-tree edges that can be swapped with the `cutEdge` and have
 * the tree remain a spanning tree. The edge with the minimal slack is returned.
 *
 * @param graph A graph object.
 * @param tree A spanning tree.
 * @param ranks A rank table.
 * @param cutEdge The edge to be cut.
 * @returns A viable non-tree edge with minimal slack.
 */
function getNontreeMinSlackEdge(
  graph: Graph,
  tree: Graph,
  ranks: RankTable,
  cutEdge: Edge
) {
  const { v, w } = cutEdge;
  const { number: vNumber, minSubtreeNumber: vMinSubtreeNumber } = tree.node(v);
  const { number: wNumber, minSubtreeNumber: wMinSubtreeNumber } = tree.node(w);
  const rootNodeIsInHeadComponent = vNumber < wNumber;
  let checkNodeInTailComponent: (node: NodeId) => boolean;
  let minSlack = Infinity;
  let minSlackEdge: Edge | null = null;

  if (rootNodeIsInHeadComponent) {
    checkNodeInTailComponent = (node) => {
      const nodeNumber = tree.node(node).number;
      return vMinSubtreeNumber <= nodeNumber && nodeNumber <= vNumber;
    };
  } else {
    checkNodeInTailComponent = (node) => {
      const nodeNumber = tree.node(node).number;
      return wMinSubtreeNumber <= nodeNumber && nodeNumber <= wNumber;
    };
  }

  for (const edge of graph.edges()) {
    if (tree.hasEdge(edge)) continue;

    const { v: otherV, w: otherW } = edge;
    const edgeSlack = Math.abs(ranks.getRank(otherV)! - ranks.getRank(otherW)!);
    const vIsInHeadComponent = !checkNodeInTailComponent(otherV);
    const wIsInTailComponent = checkNodeInTailComponent(otherW);

    if (vIsInHeadComponent && wIsInTailComponent && edgeSlack < minSlack) {
      minSlack = edgeSlack;
      minSlackEdge = edge;
    }
  }

  return minSlackEdge;
}

/**
 * Optimally updates ranks, numberings and cut values with respect to the
 * addition of the `newTreeEdge`.
 *
 * @param graph A graph object.
 * @param tree A spanning tree.
 * @param ranks A rank table.
 * @param newTreeEdge A newly added tree edge.
 * @returns An updated rank table.
 */
function updateTreeValues(
  graph: Graph,
  tree: Graph,
  ranks: RankTable,
  newTreeEdge: Edge
) {
  const rootNode = graph.nodes()[0];
  const { v, w } = newTreeEdge;
  const commonAncestor = getClosestCommonAncestor(tree, v, w)!;

  if (commonAncestor === rootNode) {
    setCutValues(graph, tree);
    return setRanks(tree);
  }

  updateRanks(tree, ranks, commonAncestor);

  const ancestorLabel = tree.node(commonAncestor);
  const nodeStack = tree.neighbors(commonAncestor)!.filter((neighbor) => {
    return ancestorLabel.number < tree.node(neighbor).number;
  });

  postorderNumber(
    tree,
    commonAncestor,
    nodeStack,
    ancestorLabel.minSubtreeNumber
  );
  postorderSetCutValues(graph, tree, commonAncestor, nodeStack);

  return ranks;
}

/**
 * Finds the closest common ancestor of two nodes in a tree. Returns `undefined`
 * if an ancestor somehow cannot be found.
 *
 * @param tree A tree graph object.
 * @param node0 A tree node.
 * @param node1 Another tree node.
 * @returns The closest common ancestor of `node0` and `node1`.
 */
function getClosestCommonAncestor(tree: Graph, node0: NodeId, node1: NodeId) {
  const node0Number = tree.node(node0).number;
  const node1Number = tree.node(node1).number;
  const lowestNumber = Math.min(node0Number, node1Number);
  const highestNumber = Math.max(node0Number, node1Number);
  const nodes = tree.neighbors(node0)!;

  for (const node of nodes) {
    const { number, minSubtreeNumber } = tree.node(node);

    if (minSubtreeNumber <= highestNumber && lowestNumber <= number)
      return node;

    tree.neighbors(node)!.forEach((neighbor) => {
      if (!nodes.includes(neighbor)) nodes.push(neighbor);
    });
  }
}

/**
 * Updates the ranks of all nodes in the subtree rooted in `subtreeRoot`.
 *
 * @param tree A tree graph object.
 * @param ranks A rank table.
 * @param subtreeRoot The node whose subtree must be updated.
 */
function updateRanks(tree: Graph, ranks: RankTable, subtreeRoot: NodeId) {
  const subtreeRootNumber = tree.node(subtreeRoot).number;
  const subtreeNodes: NodeId[] = tree
    .neighbors(subtreeRoot)!
    .filter((neighbor) => tree.node(neighbor).number < subtreeRootNumber);

  for (const node of subtreeNodes) {
    const nodeNeighbors = tree.neighbors(node)!;
    const nodeNumber = tree.node(node).number;

    nodeNeighbors.forEach((neighbor) => {
      const neighborNumber = tree.node(neighbor).number;
      if (neighborNumber < nodeNumber) subtreeNodes.push(neighbor);
    });
  }

  const newRanks = setRanks(tree, subtreeNodes);

  subtreeNodes.forEach((node) => {
    ranks.set(node, newRanks.getRank(node)!);
  });
}

/**
 * Adjusts all ranks so that the smallest rank is 0.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 */
function normalizeRanks(graph: Graph, ranks: RankTable) {
  const smallestRank = ranks.getMinRankIndex();

  if (smallestRank !== 0)
    graph.nodes().forEach((node) => {
      const rank = ranks.getRank(node)!;
      ranks.set(node, rank - smallestRank);
    });
}

/**
 * Balances the layering by moving nodes with equal in and out degrees and
 * multiple viable ranks to the one with the least number of nodes.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 */
function balanceLayering(graph: Graph, ranks: RankTable) {
  for (const node of graph.nodes()) {
    const inDegree = (graph.inEdges(node) || []).length;
    const outDegree = (graph.outEdges(node) || []).length;

    if (inDegree !== outDegree) continue;

    const parentRanks = (graph.predecessors(node) || []).map(
      (parent) => ranks.getRank(parent)!
    );
    const childRanks = (graph.successors(node) || []).map(
      (child) => ranks.getRank(child)!
    );
    const maxParentRank = Math.max(...parentRanks);
    const minChildRank = Math.min(...childRanks);
    const nodeCanBeMoved = minChildRank - maxParentRank > 2;

    if (nodeCanBeMoved) {
      const firstViableRank = parentRanks.length > 0 ? maxParentRank + 1 : 0;
      const lastViableRank =
        childRanks.length > 0 ? minChildRank - 1 : ranks.getMaxRankIndex();
      let minRank = ranks.getRank(node)!;
      let minRankSize = ranks.getNodes(minRank)!.size;

      for (
        let rankIndex = firstViableRank;
        rankIndex <= lastViableRank;
        rankIndex++
      ) {
        const rankSize = ranks.getNodes(rankIndex)!.size;

        if (rankSize < minRankSize) {
          minRank = rankIndex;
          minRankSize = rankSize;
        }
      }

      ranks.set(node, minRank);
    }
  }
}

/**
 * Splits conjunct nodes by restoring the subnodes and their edges.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 */
function splitConjunctNodes(
  graph: Graph,
  ranks: RankTable,
  conjunctNodes: NodeId[]
) {
  conjunctNodes.forEach((node) => {
    const { subnodeData, originalEdges } = graph.node(node);

    Object.keys(subnodeData).forEach((subnode) => {
      graph.setNode(subnode, subnodeData[subnode]);
      graph.setParent(subnode, node);
      ranks.set(subnode, ranks.getRank(node)!);
    });

    originalEdges.forEach((edge: EdgeAndLabel) => {
      const { v, w, label, name } = edge;
      graph.setEdge(v, w, label, name);
    });

    const conjunctTarget = node.substring(3);

    for (const edge of graph.nodeEdges(node)!) {
      if (edge.w === conjunctTarget) continue;
      graph.removeEdge(edge);
    }
  });
}

/**
 * Splits relevance structures by restoring the subnodes and their edges. Also
 * adjusts ranks of any successors.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 * @param metaRelevanceNodes A list of meta relevance nodes.
 */
function splitRelevanceStructures(
  graph: Graph,
  ranks: RankTable,
  metaRelevanceNodes: NodeId[]
) {
  if (!metaRelevanceNodes.length) return;

  const relevanceStructureNodes: NodeId[] = [];
  let sink = "";
  let relevanceSink = "";
  let relevanceSource = "";

  metaRelevanceNodes.forEach((node) => {
    const { subnodeData, originalEdges } = graph.node(node);

    Object.keys(subnodeData).forEach((subnode) => {
      graph.setNode(subnode, subnodeData[subnode]);
      ranks.set(subnode, ranks.getRank(node)!);
      relevanceStructureNodes.push(subnode);

      if (subnodeData[subnode].isRelevanceSink) {
        sink = subnode.split(" -> ")[1];
        relevanceSink = subnode;
      }
    });

    originalEdges.forEach((edge: EdgeAndLabel) => {
      const { v, w, label, name } = edge;
      if (relevanceSink === w) relevanceSource = v;
      graph.setEdge(v, w, label, name);
    });

    graph.removeNode(node);
    ranks.delete(node);
  });

  ranks.set(sink, ranks.getRank(sink)! + 1);
  ranks.set(relevanceSink, ranks.getRank(relevanceSink)! + 0.5);
  ranks.set(relevanceSource, ranks.getRank(relevanceSource)! + 0.5);
}

/**
 * Assigns y-coordinates to all nodes based on their ranks.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 */
function setYCoordinates(graph: Graph, ranks: RankTable) {
  graph.nodes().forEach((node) => {
    const rank = ranks.getRank(node)!;
    const y = rank * NODE_Y_SPACING;

    graph.node(node).y = y;
  });
}
