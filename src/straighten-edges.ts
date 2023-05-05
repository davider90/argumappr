import Graph from "./graph";
import {
  NodeId,
  buildSimpleGraph,
  mergeConjunctNodes,
  splitConjunctNodes,
} from "./utils";

type Direction = "right down" | "right up" | "left down" | "left up";
type BiasedGraphTuple = readonly [
  leftTopBiasedGraph: Graph,
  leftBottomBiasedGraph: Graph,
  rightTopBiasedGraph: Graph,
  rightBottomBiasedGraph: Graph
];

const REQUIRED_PROPERTIES = { edgeProperties: ["isConflicted"] };
const ITERATION_ORDERS: readonly Direction[] = [
  "right down",
  "right up",
  "left down",
  "left up",
];

/**
 * Assigns all nodes *x*-coordinates according to aesthetic criteria, favoring
 * straight edges.
 *
 * @remarks
 * This algorithm is based on the Brandes–Köpf algorithm. It works by producing
 * four *direction-biased* coordinate assignments, aligning them and then using
 * the average median of the four assignments. Each assignment is made by
 * vertically aligning nodes and then horizontally compacting them. The used
 * iteration order affects the resulting layout, which is why they are combined
 * to cancel biases. The algorithm has a run time of *O(|V| + |E|)*.
 *
 * @see
 * [Fast and Simple Horizontal Coordinate Assignment](https://link.springer.com/chapter/10.1007/3-540-45848-4_3)
 *
 * @param graph A graph object. Must be directed and acyclic.
 * @param graphMatrix A matrix imposing a layering and ordering on the nodes.
 */
export default function straightenEdges(graph: Graph, graphMatrix: NodeId[][]) {
  restoreConjunctNodes(graph, graphMatrix);
  const conjunctNodes = mergeConjunctNodes(graph);
  markConflicts(graph, graphMatrix);

  const biasedGraphs: BiasedGraphTuple = [
    buildSimpleGraph(graph, REQUIRED_PROPERTIES),
    buildSimpleGraph(graph, REQUIRED_PROPERTIES),
    buildSimpleGraph(graph, REQUIRED_PROPERTIES),
    buildSimpleGraph(graph, REQUIRED_PROPERTIES),
  ];

  biasedGraphs.forEach((biasedGraph, graphIndex) => {
    const horizontalDirection = ITERATION_ORDERS[graphIndex].split(" ")[0] as
      | "right"
      | "left";

    alignVertically(biasedGraph, graphMatrix, ITERATION_ORDERS[graphIndex]);
    compactHorizontally(
      biasedGraph,
      graphMatrix,
      horizontalDirection,
      graph.graph().nodesep
    );
  });

  alignToMinWidthGraph(biasedGraphs);
  balanceAndAssignValues(graph, biasedGraphs, conjunctNodes);
}

/**
 * Restores conjunct nodes to their original, pre-crossing-minimisation state.
 * Also calculates their width.
 *
 * @param graph A graph object.
 * @param graphMatrix A node matrix.
 */
function restoreConjunctNodes(graph: Graph, graphMatrix: NodeId[][]) {
  const conjunctDummyNodes = graph
    .nodes()
    .filter((node) => graph.node(node).isConjunctDummyNode);
  const startDummyNodes: NodeId[] = [];
  const endDummyNodes: NodeId[] = [];

  conjunctDummyNodes.forEach((node) => {
    if (node.slice(0, 5) === "start") startDummyNodes.push(node);
    else endDummyNodes.push(node);
  });

  startDummyNodes.forEach((node) => {
    const { conjunctNode } = graph.node(node);
    graph.setNode(conjunctNode.id, conjunctNode.label);

    const layerIndex = graph.node(node).y / graph.graph().ranksep;
    const layer = graphMatrix[layerIndex];
    const nodeIndex = layer.indexOf(node);
    let index = nodeIndex + 1;
    let currentNode = layer[index];
    let conjunctNodeWidth = 0;
    const conjunctTarget = conjunctNode.id.substring(3);
    const { conjunctEdgeLabel } = graph.edge(currentNode, conjunctTarget);

    while (!graph.node(currentNode).isConjunctDummyNode) {
      graph.removeEdge(currentNode, conjunctTarget);
      graph.setParent(currentNode, conjunctNode.id);

      const currentNodeWith: number = graph.node(currentNode).width;

      index++;
      currentNode = layer[index];
      conjunctNodeWidth += currentNodeWith + graph.graph().nodesep;
    }

    conjunctNodeWidth -= graph.graph().nodesep;

    graph.node(conjunctNode.id).width = conjunctNodeWidth;
    graph.setEdge(conjunctNode.id, conjunctTarget, conjunctEdgeLabel);
    graph.removeNode(node);
  });

  endDummyNodes.forEach((node) => {
    graph.removeNode(node);
  });
}

/**
 * Marks all *type 1 conflicts*, which are edges crossing long (spanning more
 * than one layer) edges, so that they are resolved in favour of the long edges
 * (i.e., favour straight long edges). Also ensures that conjunct nodes are
 * aligned with their targets.
 *
 * @param graph A graph object.
 * @param graphMatrix A node matrix.
 */
function markConflicts(graph: Graph, graphMatrix: NodeId[][]) {
  graph.edges().forEach((edge) => {
    graph.setEdge(edge, { isConflicted: false });
  });

  for (let layerIndex = 1; layerIndex < graphMatrix.length - 2; layerIndex++) {
    const layer = graphMatrix[layerIndex + 1];
    let predecessor0Index = 0;
    let node1Index = 1;

    for (let nodeIndex = 0; nodeIndex < layer.length; nodeIndex++) {
      const node0 = layer[nodeIndex];

      if (graph.node(node0).isConjunctNode) {
        const targetNode = node0.substring(3);

        for (const edge of graph.outEdges(node0)!) {
          if (edge.w === targetNode) continue;
          graph.edge(edge).isConflicted = true;
        }
      }

      if (nodeIndex === layer.length - 1 || graph.node(node0)?.isDummyNode) {
        let predecessor1Index = graphMatrix[layerIndex].length - 1;

        if (graph.node(node0)?.isDummyNode) {
          const predecessor = graph.predecessors(node0)![0];
          predecessor1Index = graphMatrix[layerIndex].indexOf(predecessor);
        }

        while (node1Index <= nodeIndex) {
          const node1 = layer[node1Index];
          const predecessors = graph.predecessors(node1) || [];

          for (
            let predecessorIndex = 0;
            predecessorIndex < predecessors.length;
            predecessorIndex++
          ) {
            const predecessor = predecessors[predecessorIndex];

            if (
              predecessorIndex < predecessor0Index ||
              predecessorIndex > predecessor1Index
            ) {
              graph.edge(predecessor, node1).isConflicted = true;
            }
          }

          node1Index++;
        }

        predecessor0Index = predecessor1Index;
      }
    }
  }
}

/**
 * Vertically aligns each node with a median neighbor. Uses a linked list
 * structure where each node is assigned a root node and a next node. The
 * resulting alignment will be biased based on the given iteration order.
 *
 * @param graph A graph object.
 * @param graphMatrix A node matrix.
 * @param iterationOrder The order in which to iterate over the nodes.
 */
function alignVertically(
  graph: Graph,
  graphMatrix: NodeId[][],
  iterationOrder: Direction
) {
  const orderings = iterationOrder.split(" ");
  const isLeftBiased = orderings[0] === "right";
  const isTopBiased = orderings[1] === "down";

  for (const node of graph.nodes()) {
    const nodeLabel = graph.node(node);

    if (nodeLabel.isConjunctNode) continue;

    nodeLabel.blockRoot = node;
    nodeLabel.nextBlockNode = node;
  }

  for (
    let layerIndex = isTopBiased ? 0 : graphMatrix.length - 1;
    isTopBiased ? layerIndex < graphMatrix.length : layerIndex >= 0;
    isTopBiased ? layerIndex++ : layerIndex--
  ) {
    const layer = graphMatrix[layerIndex];
    let previousNeighborIndex: number;

    if (isLeftBiased) previousNeighborIndex = -1;
    else previousNeighborIndex = Infinity;

    for (
      let nodeIndex = isLeftBiased ? 0 : layer.length - 1;
      isLeftBiased ? nodeIndex < layer.length : nodeIndex >= 0;
      isLeftBiased ? nodeIndex++ : nodeIndex--
    ) {
      const node = layer[nodeIndex];
      let neighbors: NodeId[];

      if (isTopBiased) neighbors = graph.predecessors(node) || [];
      else neighbors = graph.successors(node) || [];

      if (neighbors.length) {
        const neighborLayerIndex = layerIndex + (isTopBiased ? -1 : 1);
        neighbors = graphMatrix[neighborLayerIndex].filter((node) =>
          neighbors.includes(node)
        );
        const maxNeighborIndex = neighbors.length - 1;
        const leftNeighborIndex = Math.floor(maxNeighborIndex / 2);
        const rightNeighborIndex = Math.ceil(maxNeighborIndex / 2);

        for (
          let neighborIndex = isLeftBiased
            ? leftNeighborIndex
            : rightNeighborIndex;
          isLeftBiased
            ? neighborIndex <= rightNeighborIndex
            : neighborIndex >= leftNeighborIndex;
          isLeftBiased ? neighborIndex++ : neighborIndex--
        ) {
          const neighbor = neighbors[neighborIndex];

          if (graph.node(node).nextBlockNode === node && neighbor) {
            const edgeIsConflicted: boolean = graph.edge(
              isTopBiased ? neighbor : node,
              isTopBiased ? node : neighbor
            ).isConflicted;
            const alignmentDoesNotOverlap = isLeftBiased
              ? previousNeighborIndex < neighborIndex
              : previousNeighborIndex > neighborIndex;

            if (!edgeIsConflicted && alignmentDoesNotOverlap) {
              if (isTopBiased) {
                const neighborRoot = graph.node(neighbor).blockRoot;

                graph.node(neighbor).nextBlockNode = node;
                graph.node(node).blockRoot = neighborRoot;
                graph.node(node).nextBlockNode = neighborRoot;
              } else {
                graph.node(node).nextBlockNode = neighbor;

                let blockNode = neighbor;

                while (graph.node(blockNode).nextBlockNode !== neighbor) {
                  graph.node(blockNode).blockRoot = node;
                  blockNode = graph.node(blockNode).nextBlockNode;
                }

                graph.node(blockNode).blockRoot = node;
                graph.node(blockNode).nextBlockNode = node;
              }

              previousNeighborIndex = neighborIndex;
            }
          }
        }
      }
    }
  }
}

/**
 * Assigns *x*-coordinates to nodes based on their alignment. Does three passes
 * over the nodes: First, it assigns default values to all nodes; second, it
 * invokes {@link placeBlock} on all block roots; third, it distributes the
 * information from the roots and assigns absolute coordinates to all nodes.
 *
 * @param graph A graph object. Must have been vertically aligned.
 * @param graphMatrix A node matrix.
 * @param iterationOrder The direction in which to iterate over the nodes.
 * @param minNodeSeperation Minimum distance between nodes.
 */
function compactHorizontally(
  graph: Graph,
  graphMatrix: NodeId[][],
  iterationOrder: "right" | "left",
  minNodeSeperation: number
) {
  const defaultXShift = iterationOrder === "right" ? Infinity : -Infinity;

  graph.nodes().forEach((node) => {
    graph.node(node).classSink = node;
    graph.node(node).xShift = defaultXShift;
  });

  graph.nodes().forEach((node) => {
    if (graph.node(node).blockRoot === node) {
      placeBlock(graph, graphMatrix, node, iterationOrder, minNodeSeperation);
    }
  });

  graph.nodes().forEach((node) => {
    const nodeBlockRoot = graph.node(node).blockRoot;
    const nodeClassSink = graph.node(nodeBlockRoot).classSink;
    graph.node(node).x = graph.node(nodeBlockRoot).x;

    if (
      (iterationOrder === "right" &&
        graph.node(nodeClassSink).xShift < Infinity) ||
      (iterationOrder === "left" &&
        graph.node(nodeClassSink).xShift > -Infinity)
    ) {
      graph.node(node).x += graph.node(nodeClassSink).xShift;
    }
  });
}

/**
 * Determines the relative coordinates of block roots with respect to their
 * corresponding classes. Uses a recursive version of longest path layering.
 *
 * @param graph A graph object.
 * @param graphMatrix A node matrix.
 * @param node A node ID.
 * @param iterationOrder The direction in which to iterate over the nodes.
 * @param minNodeSeperation Minimum distance between nodes.
 */
function placeBlock(
  graph: Graph,
  graphMatrix: NodeId[][],
  node: NodeId,
  iterationOrder: "right" | "left",
  minNodeSeperation: number
) {
  if (graph.node(node).x !== undefined) return;

  const isLeftBiased = iterationOrder === "right";
  graph.node(node).x = 0;
  let currentNode = node;

  do {
    const layerIndex = graphMatrix.findIndex((layer) =>
      layer.includes(currentNode)
    )!;
    const layer = graphMatrix[layerIndex];
    const nodeIndex = layer.indexOf(currentNode);

    if (
      (isLeftBiased && nodeIndex > 0) ||
      (!isLeftBiased && nodeIndex < layer.length - 1)
    ) {
      const previousNodeIndex = isLeftBiased ? nodeIndex - 1 : nodeIndex + 1;
      const previousNode = layer[previousNodeIndex];
      const previousNodeRoot = graph.node(previousNode).blockRoot;

      placeBlock(
        graph,
        graphMatrix,
        previousNodeRoot,
        iterationOrder,
        minNodeSeperation
      );

      if (graph.node(node).classSink === node)
        graph.node(node).classSink = graph.node(previousNodeRoot).classSink;

      const nodeLabel = graph.node(node);
      const previousNodeLabel = graph.node(previousNodeRoot);
      const nodeX: number = nodeLabel.x;
      const previousNodeX: number = previousNodeLabel.x;
      const nodeWidth: number = nodeLabel.width;
      const previousNodeWidth: number = previousNodeLabel.width;
      const sign = isLeftBiased ? 1 : -1;

      if (
        graph.node(node).classSink !== graph.node(previousNodeRoot).classSink
      ) {
        const previousNodeSink = graph.node(previousNodeRoot).classSink;
        const pickValue = isLeftBiased ? Math.min : Math.max;
        const seperation =
          nodeX -
          nodeWidth -
          (previousNodeX + previousNodeWidth) -
          minNodeSeperation;
        const xShift = pickValue(
          graph.node(previousNodeSink).xShift,
          seperation * sign
        );
        graph.node(previousNodeSink).xShift = xShift;
      } else {
        const pickValue = isLeftBiased ? Math.max : Math.min;
        const seperation =
          previousNodeX + previousNodeWidth + minNodeSeperation;
        const newNodeX = pickValue(nodeX, seperation * sign);
        graph.node(node).x = newNodeX;
      }
    }
    currentNode = graph.node(currentNode).nextBlockNode;
  } while (currentNode !== node);
}

/**
 * Aligns the graphs to the one with the smallest width, the two leftmost
 * so that their minimum coordinates agree with it, the two rightmost so that
 * their maximum coordinates agree with it.
 *
 * @param biasedGraphs Four biased graphs. Must be ordered LT, LB, RT, RB.
 */
function alignToMinWidthGraph(biasedGraphs: BiasedGraphTuple) {
  let minWidth = Infinity;
  let minWidthIndex = -1;

  const widthObjects = biasedGraphs.map((graph, graphIndex) => {
    let minGraphX = Infinity;
    let maxGraphX = -Infinity;

    graph.nodes().forEach((node) => {
      const nodeX: number = graph.node(node).x;
      const nodeWidth: number = graph.node(node).width;
      const leftBorderX = nodeX - nodeWidth / 2;
      const rightBorderX = nodeX + nodeWidth / 2;

      if (leftBorderX < minGraphX) minGraphX = leftBorderX;
      if (rightBorderX > maxGraphX) maxGraphX = rightBorderX;
    });

    const graphWidth = maxGraphX - minGraphX;
    if (graphWidth < minWidth) {
      minWidth = graphWidth;
      minWidthIndex = graphIndex;
    }

    return {
      width: graphWidth,
      minX: minGraphX,
      maxX: maxGraphX,
    };
  });

  const { minX, maxX } = widthObjects[minWidthIndex];

  biasedGraphs.forEach((graph, graphIndex) => {
    const { minX: graphMinX, maxX: graphMaxX } = widthObjects[graphIndex];
    const xShift = graphIndex < 2 ? minX - graphMinX : maxX - graphMaxX;

    graph.nodes().forEach((node) => {
      graph.node(node).x += xShift;
    });
  });
}

/**
 * Assigns all nodes the average median of their four biased coordinates, and
 * sets the width property of the graph.
 *
 * @param graph A graph object.
 * @param biasedGraphs Four biased graphs.
 */
function balanceAndAssignValues(
  graph: Graph,
  biasedGraphs: BiasedGraphTuple,
  conjunctNodes: NodeId[]
) {
  let smallestX = Infinity;
  let largestX = -Infinity;

  graph.nodes().forEach((node) => {
    const biasedNodes: number[] = [
      biasedGraphs[0].node(node).x,
      biasedGraphs[1].node(node).x,
      biasedGraphs[2].node(node).x,
      biasedGraphs[3].node(node).x,
    ].sort((a, b) => a - b);
    const newNodeX = (biasedNodes[1] + biasedNodes[2]) / 2;
    const nodeLabel = graph.node(node);
    nodeLabel.x = newNodeX;
    const leftBorderX = newNodeX - nodeLabel.width / 2;
    const rightBorderX = newNodeX + nodeLabel.width / 2;

    if (leftBorderX < smallestX) smallestX = leftBorderX;
    if (rightBorderX > largestX) largestX = rightBorderX;
  });

  graph.graph().width = largestX - smallestX;

  splitConjunctNodes(graph, conjunctNodes);

  conjunctNodes.forEach((node) => {
    let x = graph.node(node).x - graph.node(node).width / 2;

    graph.children(node).forEach((child) => {
      const childLabel = graph.node(child);
      const newNodeX = x + childLabel.width / 2;
      childLabel.x = newNodeX;
      x = newNodeX + childLabel.width / 2 + graph.graph().nodesep;
    });
  });
}
