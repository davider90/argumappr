import { Edge, Graph } from "graphlib";
import { NodeId, RankTable, appendNodeValues } from "./utils";

/**
 * Minimises the number of crossings between the ranks of a graph by iteratively
 * sweeping the ranks from top to bottom and bottom to top until an optimum is
 * reached. This is based on the down-up barycenter heuristic described by
 * Sugiyama et al. The algorithm might not produce the global optimum, but it
 * will always find a positioning with 0 crossings if one exists. Also, it has
 * been reported to consistently be within 3 percent of optimal.
 *
 * @see https://ieeexplore.ieee.org/document/4308636
 * @remarks Reportedly, among the best run times of algorithms for this problem.
 *
 * @param graph A graphlib graph object.
 * @param ranks A ranking of the nodes in the graph.
 */
export default function minimiseCrossings(graph: Graph, ranks: RankTable) {
  splitNonTightEdges(graph, ranks);

  const graphMatrix = readRankTable(ranks);
  let crossingCount = countTotalCrossings(graph, graphMatrix);

  while (crossingCount > 0) {
    for (let i = 0; i < graphMatrix.length - 1; i++) {
      const layer = graphMatrix[i];
      sweepLayer(graph, ranks, graphMatrix, layer, "down");
    }

    for (let i = graphMatrix.length - 1; i > 0; i--) {
      const layer = graphMatrix[i];
      sweepLayer(graph, ranks, graphMatrix, layer, "up");
    }

    const newCrossingCount = countTotalCrossings(graph, graphMatrix);
    if (newCrossingCount >= crossingCount) break;
    crossingCount = newCrossingCount;
  }

  return graphMatrix;
}

/**
 * Splits non-tight edges into a series of tight edges by inserting dummy nodes
 * at each rank between the source and target of the edge.
 *
 * @param graph A graphlib graph object.
 * @param ranks A ranking of the nodes in the graph.
 */
function splitNonTightEdges(graph: Graph, ranks: RankTable) {
  graph.edges().forEach((edge) => {
    const { v, w } = edge;
    const vRankNumber = ranks.getRankNumber(v)!;
    const wRankNumber = ranks.getRankNumber(w)!;
    let i = 0;
    let previousNodeId = v;

    for (let j = vRankNumber + 1; j < wRankNumber; j++) {
      const dummyNodeId = `${v}-${w}-${i}`;

      graph.setNode(dummyNodeId, { isDummyNode: true });
      graph.setEdge(previousNodeId, dummyNodeId);

      i++;
      previousNodeId = dummyNodeId;
    }

    if (i > 0) {
      graph.setEdge(previousNodeId, w);
      graph.removeEdge(edge);
    }
  });
}

/**
 * Sweeps a layer of the graph, updating the barycenter of each node in the
 * layer.
 * @private
 *
 * @param graph A graphlib graph object. Must be directed.
 * @param ranks A rank table.
 * @param graphMatrix A rank matrix.
 * @param layer The layer to sweep.
 * @param direction The direction we are iterating through layers.
 */
function sweepLayer(
  graph: Graph,
  ranks: RankTable,
  graphMatrix: NodeId[][],
  layer: NodeId[],
  direction: "up" | "down"
) {
  for (let nodeIndex = 0; nodeIndex < layer.length; nodeIndex++) {
    const node = layer[nodeIndex];

    if (!node.length) continue;

    const neighbors =
      direction === "down"
        ? graph.successors(node)!
        : graph.predecessors(node)!;

    if (!neighbors.length) {
      appendNodeValues(graph, node, { barycenter: nodeIndex });
      continue;
    }

    let neighborsPositionSum = 0;

    neighbors.forEach((neighbor) => {
      const neighborRankNumber = ranks.getRankNumber(neighbor)!;
      const neighborLayer = graphMatrix[neighborRankNumber];
      const neighborPosition = neighborLayer.indexOf(neighbor);
      neighborsPositionSum += neighborPosition;
    });

    const neighborsPositionAverage = neighborsPositionSum / neighbors.length;
    appendNodeValues(graph, node, { barycenter: neighborsPositionAverage });
  }

  layer.sort((v, w) => {
    if (!v.length || !w.length) return 0;

    const vBarycenter = graph.node(v).barycenter;
    const wBarycenter = graph.node(w).barycenter;

    if (vBarycenter < wBarycenter) return -1;
    if (vBarycenter > wBarycenter) return 1;
    return 0;
  });
}

/**
 * @private
 *
 * @param ranks A rank table (mapping).
 * @returns A rank matrix (array of arrays).
 */
function readRankTable(ranks: RankTable) {
  const graphMatrix: NodeId[][] = [];
  let rankNumber = 0;
  let layer = ranks.getRankNodes(rankNumber);

  while (layer) {
    graphMatrix[rankNumber] = [];

    layer.forEach((_, node) => {
      graphMatrix[rankNumber].push(node);
    });

    rankNumber++;
    layer = ranks.getRankNodes(rankNumber);
  }

  return graphMatrix;
}

/**
 * @private
 *
 * @param graph A graphlib graph object.
 * @param graphMatrix A matrix of nodes.
 * @returns The total number of crossings in the graph.
 */
export function countTotalCrossings(graph: Graph, graphMatrix: NodeId[][]) {
  let crossings = 0;

  for (let i = 1; i < graphMatrix.length; i++) {
    const layer = graphMatrix[i];
    const previousLayer = graphMatrix[i - 1];
    crossings += countCrossings(graph, previousLayer, layer);
  }

  return crossings;
}

/**
 * Counts the number of crossings between two layers of a graph. The algorithm
 * is based on Barth et al.'s accumulation tree.
 * @private
 *
 * @see https://link.springer.com/chapter/10.1007/3-540-36151-0_13
 * @remarks Run time of O(|E| * log|V_small|), where V_small is the smaller of
 * the two layers.
 *
 * @param graph A graphlib graph object.
 * @param northLayer Array of nodes in northern layer.
 * @param southLayer Array of nodes in southern layer.
 * @returns The number of crossings between the layers.
 */
export function countCrossings(
  graph: Graph,
  northLayer: NodeId[],
  southLayer: NodeId[]
) {
  let firstindex = 1;

  while (firstindex < southLayer.length) firstindex *= 2;

  const treesize = 2 * firstindex - 1;
  firstindex -= 1;
  const tree = new Array(treesize).fill(0);
  let crosscount = 0;
  let edges: Edge[];

  if (northLayer.length >= southLayer.length) {
    edges = northLayer.flatMap((node) => graph.outEdges(node)!);
  } else {
    edges = southLayer.flatMap((node) => graph.inEdges(node)!);
  }

  edges.forEach((edge) => {
    const head = edge.w;
    const headIndex = southLayer.indexOf(head);
    let index = headIndex + firstindex;
    tree[index]++;

    while (index > 0) {
      if (index % 2) crosscount += tree[index + 1];
      index = Math.floor((index - 1) / 2);
      tree[index]++;
    }
  });

  return crosscount;
}
