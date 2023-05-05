import { Edge } from "graphlib";
import Graph from "./graph";
import { NodeId, RankTable, appendNodeValues, buildSimpleGraph } from "./utils";

/**
 * Tries to minimise the number of edge crossings by reordering nodes within
 * layers according to a heuristic. Returns a node position matrix.
 *
 * @remarks
 * The barycenter heuristic was originally described by Sugiyama et al, but this
 * implementation is based on Forster's constrained version. It reduces the
 * number of crossings by considering layers pairwise, viewing one as fixed and
 * the other as mutable. The mutable layer is sorted based the average position
 * of nodes' neighbors. Ranks are iteratively swept from top to bottom and
 * bottom to top until an optimum is reached. A constraint graph is used to
 * represent ordering constraints. During sweeps, nodes are only reordered such
 * that no constraints are violated. The algorithm might not produce the global
 * optimum, but it will always find a state with nil crossings if one exists.
 * The original barycenter algorithm has been reported to consistently be within
 * three percent of optimal and have among the best run times of algorithms for
 * this problem. This constrained version is expected to produce *good enough*
 * results and has a run time of
 * *O(|V_2| log|V_2| + |E| log|V_s| + |E| + |C|^2)*, where *V_2* is the
 * nodes of the mutable layer and *V_s* is the nodes of the smaller layer of the
 * two.
 *
 * @see
 * [A Fast and Simple Heuristic for Constrained Two-Level Crossing Reduction](https://link.springer.com/chapter/10.1007/978-3-540-31843-9_22)
 *
 * @param graph A graph object. Must be directed and acyclic.
 * @param ranks A ranking of the nodes in the graph.
 * @returns A node matrix.
 */
export default function minimiseCrossings(graph: Graph, ranks: RankTable) {
  const constraintGraph = preprocessDataStructures(graph, ranks);
  const graphMatrix = readRankTable(ranks);
  let crossingCount = countTotalCrossings(graph, graphMatrix);
  let loopCount = 0;

  while (crossingCount > 0 && loopCount < graph.graph().maxcrossingloops) {
    loopCount++;

    sortLayers(graph, constraintGraph, graphMatrix);

    const newCrossingCount = countTotalCrossings(graph, graphMatrix);
    if (newCrossingCount >= crossingCount) break;
    crossingCount = newCrossingCount;
  }

  return graphMatrix;
}

/**
 * Splits non-tight edges, and creates and returns a constraint graph based on
 * conjunct nodes and relevance structures.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 * @returns A constraint graph.
 */
function preprocessDataStructures(graph: Graph, ranks: RankTable) {
  const constraintGraph = new Graph();

  handleRelevanceStructures(graph, ranks, constraintGraph);
  handleConjunctNodes(graph, ranks, constraintGraph);
  splitLongEdges(graph, ranks);

  return constraintGraph;
}

/**
 * Splits long (multi-layer) edges into a series of short (single-layer) edges
 * by inserting dummy nodes at each rank between the source and target of the
 * edge.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 */
function splitLongEdges(graph: Graph, ranks: RankTable) {
  graph.edges().forEach((edge) => {
    const { v, w } = edge;
    const vRank = ranks.getRank(v)!;
    const wRank = ranks.getRank(w)!;
    const vY = graph.node(v)!.y;
    const edgeData = graph.edge(edge)!;
    let dummyNodeIndex = 0;
    let previousNodeId = v;

    for (let rankIndex = vRank + 1; rankIndex < wRank; rankIndex++) {
      const dummyNodeId = `${v}-${w}-${dummyNodeIndex}`;
      const dummyNodeY = vY + (dummyNodeIndex + 1) * graph.graph().ranksep;

      graph.setNode(dummyNodeId, {
        isDummyNode: true,
        y: dummyNodeY,
        edgeData,
      });
      graph.setEdge(previousNodeId, dummyNodeId);
      ranks.set(dummyNodeId, rankIndex);

      dummyNodeIndex++;
      previousNodeId = dummyNodeId;
    }

    if (dummyNodeIndex > 0) {
      graph.setEdge(previousNodeId, w);
      graph.removeEdge(edge);
    }
  });
}

/**
 * Creates two dummy nodes for each conjunct node to act as delimiters within
 * their layer, and constrains all subnodes to be between them.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 * @param constraintGraph A constraint graph.
 */
function handleConjunctNodes(
  graph: Graph,
  ranks: RankTable,
  constraintGraph: Graph
) {
  const conjunctNodes = graph
    .nodes()
    .filter((node) => graph.node(node).isConjunctNode);

  conjunctNodes.forEach((node) => {
    const nodeLabel = graph.node(node);
    const startDummyNodeId = `start-${node}`;
    const endDummyNodeId = `end-${node}`;
    const rankNumber = ranks.getRank(node)!;

    graph.setNode(startDummyNodeId, {
      conjunctNode: { id: node, label: nodeLabel },
      isConjunctDummyNode: true,
    });
    graph.setNode(endDummyNodeId, { isConjunctDummyNode: true });
    ranks.set(startDummyNodeId, rankNumber);
    ranks.set(endDummyNodeId, rankNumber);

    const children = graph.children(node);
    const conjunctEdge = graph.outEdges(node)![0];
    const conjunctTarget = conjunctEdge.w;
    const conjunctEdgeLabel = graph.edge(conjunctEdge);

    children.forEach((child) => {
      graph.setEdge(child, conjunctTarget, {
        ...conjunctEdgeLabel,
        isConjunctEdge: true,
      });
      constraintGraph.setEdge(startDummyNodeId, child);
      constraintGraph.setEdge(child, endDummyNodeId);
    });

    const conjunctHasRelevanceEdge = constraintGraph.hasNode(node);

    if (conjunctHasRelevanceEdge) {
      const relevanceDummySource = constraintGraph.successors(node)![0];

      constraintGraph.setEdge(endDummyNodeId, relevanceDummySource);
      constraintGraph.removeNode(node);
    }

    graph.removeNode(node);
  });
}

/**
 * Creates dummy nodes for relevance structures, spreads them out on the
 * appropriate layers and constrains them to stay clustered.
 *
 * @param graph A graph object.
 * @param ranks A rank table.
 * @param constraintGraph A constraint graph.
 */
function handleRelevanceStructures(
  graph: Graph,
  ranks: RankTable,
  constraintGraph: Graph
) {
  const relevanceSinks = graph
    .nodes()
    .filter((node) => graph.node(node).isRelevanceSink);

  relevanceSinks.forEach((sink) => {
    const relevanceSource = graph.predecessors(sink)![0];
    const relevanceSourceLabel = graph.node(relevanceSource);
    const dummySource = `start ${relevanceSource}`;
    const dummySink = `end ${relevanceSource}`;
    const [simpleSource, simpleSink] = sink.split(" -> ");
    const rankNumber = ranks.getRank(simpleSource)!;

    graph.setNode(dummySource, {
      relevanceNodes: {
        source: { id: relevanceSource, label: relevanceSourceLabel },
        sink: { id: sink, label: graph.node(sink) },
      },
      y: graph.node(simpleSource).y,
      width: relevanceSourceLabel.width,
      isRelevanceDummySource: true,
    });
    graph.setNode(dummySink, {
      y: graph.node(simpleSink).y,
      width: relevanceSourceLabel.width,
      isRelevanceDummySink: true,
    });
    ranks.set(dummySource, rankNumber);
    ranks.set(dummySink, rankNumber + 1);

    constraintGraph.setEdge(simpleSource, dummySource);
    constraintGraph.setEdge(simpleSink, dummySink);

    const relevanceSourceInEdges = graph.inEdges(relevanceSource) || [];
    const relevanceSourceOutEdges = graph.outEdges(relevanceSource) || [];

    relevanceSourceInEdges.forEach((edge) => {
      graph.setEdge(edge.v, dummySource, graph.edge(edge));
    });

    for (const edge of relevanceSourceOutEdges) {
      if (edge.w === sink) continue;
      graph.setEdge(dummySink, edge.w, graph.edge(edge));
    }

    graph.removeNode(relevanceSource);
  });
}

/**
 * Reads a rank table (mapping) and returns a rank matrix (array of arrays).
 *
 * @param ranks A rank table.
 * @returns A rank matrix.
 */
function readRankTable(ranks: RankTable) {
  const graphMatrix: NodeId[][] = [];
  let rankNumber = 0;
  let layer = ranks.getNodes(rankNumber);

  while (layer) {
    graphMatrix[rankNumber] = [];

    layer.forEach((node) => {
      graphMatrix[rankNumber].push(node);
    });

    rankNumber++;
    layer = ranks.getNodes(rankNumber);
  }

  return graphMatrix;
}

/**
 * Counts the total number of edge crossings in a layered graph.
 *
 * @param graph A graph object.
 * @param graphMatrix A node matrix.
 * @returns The number of crossings in the graph.
 */
export function countTotalCrossings(graph: Graph, graphMatrix: NodeId[][]) {
  let crossings = 0;

  for (let layerIndex = 1; layerIndex < graphMatrix.length; layerIndex++) {
    const previousLayer = graphMatrix[layerIndex - 1];
    const layer = graphMatrix[layerIndex];
    crossings += countCrossings(graph, previousLayer, layer);
  }

  return crossings;
}

/**
 * Counts the number of crossings between two layers of a graph.
 *
 * @remarks
 * This algorithm is based on Barth et al.'s accumulation tree algorithm. It has
 * been slightly modified so that the south layer does not need to be smaller
 * than the north layer. The run time is *O(|E| log|V_s|)*, where *V_s* is the
 * nodes in the smaller of the two layers.
 *
 * @see
 * [Simple and Efficient Bilayer Cross Counting](https://link.springer.com/chapter/10.1007/3-540-36151-0_13)
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

/**
 * Sorts all nodes within their layers based on their barycenters. Sweeps the
 * layers once from top to bottom and once from bottom to top, viewing the
 * current layer as mutable and the previous one as immutable. Sorts the
 * sub-arrays of `graphMatrix` in-place.
 *
 * @param graph A graph object.
 * @param constraintGraph A constraint graph.
 * @param graphMatrix A node matrix.
 */
function sortLayers(
  graph: Graph,
  constraintGraph: Graph,
  graphMatrix: NodeId[][]
) {
  for (let layerIndex = 1; layerIndex < graphMatrix.length; layerIndex++) {
    const previousLayer = graphMatrix[layerIndex - 1];
    const layer = graphMatrix[layerIndex];

    graphMatrix[layerIndex] = sweepLayer(
      graph,
      constraintGraph,
      previousLayer,
      layer,
      "down"
    );
  }

  for (let layerIndex = graphMatrix.length - 2; layerIndex >= 0; layerIndex--) {
    const layer = graphMatrix[layerIndex];
    const nextLayer = graphMatrix[layerIndex + 1];

    graphMatrix[layerIndex] = sweepLayer(
      graph,
      constraintGraph,
      layer,
      nextLayer,
      "up"
    );
  }
}

/**
 * Sweeps a target layer, sorting its nodes based on the average position of
 * their neighbors in the fixed layer while taking position constraints into
 * consideration. If `direction` is `"down"`, `northLayer` is viewed as fixed
 * and `southLayer` as the target, and vice versa if `direction` is `"up"`.
 * Returns either a sorted or an unchanged version of the target layer depending
 * on which one leads to fewer edge crossings.
 *
 * @param graph A graph object.
 * @param constraintGraph A constraint graph.
 * @param northLayer The *above* node layer.
 * @param southLayer The *lower* node layer.
 * @param direction The iteration *direction*.
 * @returns A sorted layer.
 */
function sweepLayer(
  graph: Graph,
  constraintGraph: Graph,
  northLayer: NodeId[],
  southLayer: NodeId[],
  direction: "down" | "up"
) {
  const mutableConstraintGraph = buildSimpleGraph(constraintGraph);
  let targetLayer: NodeId[];
  let fixedLayer: NodeId[];

  if (direction === "down") {
    targetLayer = southLayer;
    fixedLayer = northLayer;
  } else {
    targetLayer = northLayer;
    fixedLayer = southLayer;
  }

  targetLayer.forEach((node) => {
    const neighbors =
      (direction === "down"
        ? graph.predecessors(node)
        : graph.successors(node)) || [];
    const neighborPositionSum = neighbors.reduce(
      (sum, neighbor) => sum + fixedLayer.indexOf(neighbor),
      0
    );
    const barycenter = neighborPositionSum / neighbors.length;

    appendNodeValues(mutableConstraintGraph, node, {
      barycenter,
      subnodes: [node],
    });
  });

  const unconstrainedNodes = targetLayer.filter(
    (node) => !mutableConstraintGraph.nodeEdges(node)?.length
  );
  let violatedConstraint = getViolatedConstraint(
    targetLayer,
    mutableConstraintGraph
  );

  while (violatedConstraint) {
    const { v, w } = violatedConstraint;
    let vNeighbors: NodeId[];
    let wNeighbors: NodeId[];

    if (direction === "down") {
      vNeighbors = graph.predecessors(v) || [];
      wNeighbors = graph.predecessors(w) || [];
    } else {
      vNeighbors = graph.successors(v) || [];
      wNeighbors = graph.successors(w) || [];
    }

    const vNeighborPositionSum = vNeighbors.reduce(
      (sum, neighbor) => sum + fixedLayer.indexOf(neighbor),
      0
    );
    const wNeighborPositionSum = wNeighbors.reduce(
      (sum, neighbor) => sum + fixedLayer.indexOf(neighbor),
      0
    );
    const vBarycenter = graph.node(v)!.barycenter;
    const wBarycenter = graph.node(w)!.barycenter;
    const metaNodeId = `${v}-${w}`;
    const metaNodeLabel = {
      barycenter:
        (vNeighborPositionSum + wNeighborPositionSum) /
        (vNeighbors.length + wNeighbors.length),
      subnodes: vBarycenter < wBarycenter ? [v, w] : [w, v],
    };

    mutableConstraintGraph.setNode(metaNodeId, metaNodeLabel);

    const incomingConstraints = [
      ...(mutableConstraintGraph.inEdges(v) || []),
      ...(mutableConstraintGraph.inEdges(w) || []),
    ];
    const outgoingConstraints = [
      ...(mutableConstraintGraph.outEdges(v) || []),
      ...(mutableConstraintGraph.outEdges(w) || []),
    ];

    if ([...incomingConstraints, ...outgoingConstraints].length) {
      incomingConstraints.forEach((constraint) => {
        const source = constraint.v;
        mutableConstraintGraph.removeEdge(constraint);
        if (source !== metaNodeId)
          mutableConstraintGraph.setEdge(source, metaNodeId);
      });
      outgoingConstraints.forEach((constraint) => {
        const target = constraint.w;
        mutableConstraintGraph.removeEdge(constraint);
        if (target !== metaNodeId)
          mutableConstraintGraph.setEdge(metaNodeId, target);
      });
    } else {
      unconstrainedNodes.push(metaNodeId);
    }

    violatedConstraint = getViolatedConstraint(
      southLayer,
      mutableConstraintGraph
    );
  }

  const constrainedNodes = southLayer.filter(
    (node) => mutableConstraintGraph.nodeEdges(node)?.length
  );
  const sortingList = [...unconstrainedNodes, ...constrainedNodes];
  sortingList.sort((v, w) => {
    const vBarycenter = mutableConstraintGraph.node(v)!.barycenter;
    const wBarycenter = mutableConstraintGraph.node(w)!.barycenter;
    return vBarycenter - wBarycenter;
  });
  const sortedLayer = sortingList.flatMap((node) =>
    unpackSubnodes(mutableConstraintGraph, node)
  );

  if (
    countCrossings(graph, fixedLayer, sortedLayer) <
    countCrossings(graph, northLayer, southLayer)
  )
    return sortedLayer;

  return targetLayer;
}

/**
 * Finds a violated constraint in such a way that resolving it will not lead to
 * constraint cycles, i.e., an unresolvable pair of constraints.
 *
 * @param layer A layer of nodes.
 * @param constraintGraph A constraint graph.
 * @returns A violated constraint.
 */
function getViolatedConstraint(layer: NodeId[], constraintGraph: Graph) {
  const incomingConstraints: { [node: NodeId]: Edge[] } = {};
  const nodes: NodeId[] = [];
  const constrainedNodes = layer.filter(
    (node) => constraintGraph.nodeEdges(node)?.length
  );

  constrainedNodes.forEach((node) => {
    incomingConstraints[node] = [];
    if (!constraintGraph.inEdges(node)?.length) nodes.push(node);
  });

  while (nodes.length) {
    const node = nodes.pop()!;

    for (const constraint of incomingConstraints[node]) {
      const source = constraint.v;
      if (layer.indexOf(source) >= layer.indexOf(node)) return constraint;
    }

    const outgoingConstraints = constraintGraph.outEdges(node) || [];

    outgoingConstraints.forEach((constraint) => {
      const target = constraint.w;
      incomingConstraints[target].push(constraint);

      if (
        incomingConstraints[target].length ===
        constraintGraph.inEdges(target)?.length
      ) {
        nodes.push(target);
      }
    });
  }
}

/**
 * Recursively unpacks the subnodes of a meta node (and their subnodes if any
 * and so on). Returns an array of all subnodes.
 *
 * @param graph A graph object.
 * @param node An ID of a meta node.
 * @returns The IDs of *all* subnodes of `node`.
 */
function unpackSubnodes(graph: Graph, node: NodeId): NodeId[] {
  const subnodes: NodeId[] = graph.node(node)!.subnodes;

  if (subnodes.length > 1)
    return subnodes.flatMap((subnode) => unpackSubnodes(graph, subnode));

  return subnodes;
}

// function reverseWithinLayers(
//   graph: Graph,
//   constraintGraph: Graph,
//   graphMatrix: NodeId[][]
// ) {
//   for (let i = 1; i < graphMatrix.length; i++) {
//     const previousLayer = graphMatrix[i - 1];
//     const layer = graphMatrix[i];

//     graphMatrix[i] = sweepLayer(
//       graph,
//       constraintGraph,
//       previousLayer,
//       layer,
//       "down"
//     );
//   }

//   for (let i = graphMatrix.length - 2; i >= 0; i--) {
//     const layer = graphMatrix[i];
//     const nextLayer = graphMatrix[i + 1];

//     graphMatrix[i] = sweepLayer(graph, constraintGraph, layer, nextLayer, "up");
//   }
// }

// function reverseEqualBarycenters(
//   graph: Graph,
//   constraintGraph: Graph,
//   northLayer: NodeId[],
//   southLayer: NodeId[],
//   direction: "down" | "up"
// ) {
//   const crossingCount = countCrossings(graph, northLayer, southLayer);

//   if (crossingCount === 0) return;

//   let targetLayerCopy: NodeId[];
//   let targetLayer: NodeId[];
//   let fixedLayer: NodeId[];

//   if (direction === "down") {
//     targetLayerCopy = [...southLayer];
//     targetLayer = southLayer;
//     fixedLayer = northLayer;
//   } else {
//     targetLayerCopy = [...northLayer];
//     targetLayer = northLayer;
//     fixedLayer = southLayer;
//   }

//   const barycenters = targetLayerCopy.map(
//     (node) => graph.node(node)!.barycenter
//   );

//   for (let i = 0; i < barycenters.length - 1; i++) {
//     const barycenter = barycenters[i];
//     const nextBarycenter = barycenters[i + 1];

//     if (barycenter === nextBarycenter) {
//       const node = targetLayerCopy[i];
//       const nextNode = targetLayerCopy[i + 1];
//       targetLayerCopy[i] = nextNode;
//       targetLayerCopy[i + 1] = node;
//     }
//   }

//   const newCrossingCount = countCrossings(graph, targetLayerCopy, fixedLayer);

//   if (newCrossingCount < crossingCount) {
//     targetLayer.splice(0, targetLayer.length, ...targetLayerCopy);
//   }
// }

// /**
//  * Sweeps a layer of the graph, updating the barycenter of each node in the
//  * layer.
//  * @private
//  *
//  * @param graph A graphlib graph object. Must be directed.
//  * @param ranks A rank table.
//  * @param graphMatrix A rank matrix.
//  * @param layer The layer to sweep.
//  * @param direction The direction we are iterating through layers.
//  */
// function sweepLayer(
//   graph: Graph,
//   ranks: RankTable,
//   graphMatrix: NodeId[][],
//   layer: NodeId[],
//   direction: "down" | "up"
// ) {
//   for (let nodeIndex = 0; nodeIndex < layer.length; nodeIndex++) {
//     const node = layer[nodeIndex];

//     if (!node.length) continue;

//     const neighbors =
//       direction === "down"
//         ? graph.successors(node)!
//         : graph.predecessors(node)!;

//     if (!neighbors.length) {
//       appendNodeValues(graph, node, { barycenter: nodeIndex });
//       continue;
//     }

//     let neighborsPositionSum = 0;

//     neighbors.forEach((neighbor) => {
//       const neighborRankNumber = ranks.getRankNumber(neighbor)!;
//       const neighborLayer = graphMatrix[neighborRankNumber];
//       const neighborPosition = neighborLayer.indexOf(neighbor);
//       neighborsPositionSum += neighborPosition;
//     });

//     const neighborsPositionAverage = neighborsPositionSum / neighbors.length;
//     appendNodeValues(graph, node, { barycenter: neighborsPositionAverage });
//   }

//   layer.sort((v, w) => graph.node(v)!.barycenter - graph.node(w)!.barycenter);
// }
