import { Edge } from "graphlib";
import Graph from "./graph";
import { NODE_Y_SPACING, NodeId, RankTable, appendNodeValues } from "./utils";

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
      reverseEqualBarycenters(graph, layer, graphMatrix[i + 1], "down");
    }

    for (let i = graphMatrix.length - 1; i > 0; i--) {
      const layer = graphMatrix[i];
      sweepLayer(graph, ranks, graphMatrix, layer, "up");
      reverseEqualBarycenters(graph, layer, graphMatrix[i - 1], "up");
    }

    const newCrossingCount = countTotalCrossings(graph, graphMatrix);
    if (newCrossingCount >= crossingCount) break;
    crossingCount = newCrossingCount;
  }

  return graphMatrix;
}

function reverseEqualBarycenters(
  graph: Graph,
  northLayer: NodeId[],
  southLayer: NodeId[],
  direction: "down" | "up"
) {
  const crossingCount = countCrossings(graph, northLayer, southLayer);

  if (crossingCount === 0) return;

  let targetLayerCopy: NodeId[];
  let targetLayer: NodeId[];
  let otherLayer: NodeId[];

  if (direction === "down") {
    targetLayerCopy = [...southLayer];
    targetLayer = southLayer;
    otherLayer = northLayer;
  } else {
    targetLayerCopy = [...northLayer];
    targetLayer = northLayer;
    otherLayer = southLayer;
  }

  const barycenters = targetLayerCopy.map(
    (node) => graph.node(node)!.barycenter
  );

  for (let i = 0; i < barycenters.length - 1; i++) {
    const barycenter = barycenters[i];
    const nextBarycenter = barycenters[i + 1];

    if (barycenter === nextBarycenter) {
      const node = targetLayerCopy[i];
      const nextNode = targetLayerCopy[i + 1];
      targetLayerCopy[i] = nextNode;
      targetLayerCopy[i + 1] = node;
    }
  }

  const newCrossingCount = countCrossings(graph, targetLayerCopy, otherLayer);

  if (newCrossingCount < crossingCount) {
    targetLayer.splice(0, targetLayer.length, ...targetLayerCopy);
  }
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
    const vY = graph.node(v)!.y;
    const edgeData = graph.edge(edge)!;
    let i = 0;
    let previousNodeId = v;

    for (let j = vRankNumber + 1; j < wRankNumber; j++) {
      const dummyNodeId = `${v}-${w}-${i}`;
      const dummyNodeY = vY + (i + 1) * NODE_Y_SPACING;

      graph.setNode(dummyNodeId, {
        isDummyNode: true,
        y: dummyNodeY,
        edgeData,
      });
      graph.setEdge(previousNodeId, dummyNodeId);
      ranks.set(dummyNodeId, j);

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
  direction: "down" | "up"
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

  layer.sort((v, w) => graph.node(v)!.barycenter - graph.node(w)!.barycenter);
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
    const previousLayer = graphMatrix[i - 1];
    const layer = graphMatrix[i];
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
  let layer0: NodeId[];
  let layer1: NodeId[];

  if (northLayer.length >= southLayer.length) {
    layer0 = northLayer;
    layer1 = southLayer;
  } else {
    layer0 = southLayer;
    layer1 = northLayer;
  }

  let firstindex = 1;

  while (firstindex < layer1.length) firstindex *= 2;

  const treesize = 2 * firstindex - 1;
  firstindex -= 1;
  const tree = new Array(treesize).fill(0);
  let crosscount = 0;

  const edges = layer0.reduce<Edge[]>((accumulator, node0) => {
    layer1.forEach((node1) => {
      if (graph.hasEdge(node0, node1) || graph.hasEdge(node1, node0)) {
        accumulator.push({ v: node0, w: node1 });
      }
    });

    return accumulator;
  }, []);

  edges.forEach((edge) => {
    const head = edge.w;
    const headIndex = layer1.indexOf(head);
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
