import Graph from "./graph";
import { NodeId, appendNodeValues, buildSimpleGraph } from "./utils";

type Ordering =
  | "left-right top-bottom"
  | "right-left top-bottom"
  | "left-right bottom-top"
  | "right-left bottom-top";

export default function straightenEdges(graph: Graph, graphMatrix: NodeId[][]) {
  const leftTopBiasedGraph = buildSimpleGraph(graph);
  const rightTopBiasedGraph = buildSimpleGraph(graph);
  const leftBottomBiasedGraph = buildSimpleGraph(graph);
  const rightBottomBiasedGraph = buildSimpleGraph(graph);

  markConflicts(leftTopBiasedGraph, graphMatrix);
  markConflicts(rightTopBiasedGraph, graphMatrix);
  markConflicts(leftBottomBiasedGraph, graphMatrix);
  markConflicts(rightBottomBiasedGraph, graphMatrix);

  alignVertically(leftTopBiasedGraph, graphMatrix, "left-right top-bottom");
  alignVertically(rightTopBiasedGraph, graphMatrix, "right-left top-bottom");
  alignVertically(leftBottomBiasedGraph, graphMatrix, "left-right bottom-top");
  alignVertically(rightBottomBiasedGraph, graphMatrix, "right-left bottom-top");

  compactHorizontally(leftTopBiasedGraph, graphMatrix, 5);
  compactHorizontally(rightTopBiasedGraph, graphMatrix, 5);
  compactHorizontally(leftBottomBiasedGraph, graphMatrix, 5);
  compactHorizontally(rightBottomBiasedGraph, graphMatrix, 5);

  const biasedGraphs = [
    leftTopBiasedGraph,
    rightTopBiasedGraph,
    leftBottomBiasedGraph,
    rightBottomBiasedGraph,
  ];
  const graphXObjects = biasedGraphs.map((biasedGraph) => {
    let smallestX = Infinity;
    let largestX = -Infinity;

    biasedGraph.nodes().forEach((node) => {
      const x = biasedGraph.node(node).x;
      if (x < smallestX) smallestX = x;
      if (x > largestX) largestX = x;
    });

    return {
      width: largestX - smallestX,
      smallestX,
      largestX,
    };
  });
  const smallestWidth = Math.min(...graphXObjects.map((w) => w.width));
  const smallestWidthXObject = graphXObjects.find(
    (w) => w.width === smallestWidth
  )!;

  [leftTopBiasedGraph, leftBottomBiasedGraph].forEach(
    (biasedGraph, biasedGraphIndex) => {
      const xShift =
        smallestWidthXObject.smallestX -
        graphXObjects[biasedGraphIndex].smallestX;

      biasedGraph.nodes().forEach((node) => {
        biasedGraph.node(node).x += xShift;
      });
    }
  );

  [rightTopBiasedGraph, rightBottomBiasedGraph].forEach(
    (biasedGraph, biasedGraphIndex) => {
      const correctedBiasedGraphIndex = biasedGraphIndex + 2;
      const xShift =
        smallestWidthXObject.largestX -
        graphXObjects[correctedBiasedGraphIndex].largestX;

      biasedGraph.nodes().forEach((node) => {
        biasedGraph.node(node).x += xShift;
      });
    }
  );

  graph.nodes().forEach((node) => {
    const biasedNodes: number[] = [
      leftTopBiasedGraph.node(node).x,
      rightTopBiasedGraph.node(node).x,
      leftBottomBiasedGraph.node(node).x,
      rightBottomBiasedGraph.node(node).x,
    ].sort((a, b) => a - b);
    const newNodeX = (biasedNodes[1] + biasedNodes[2]) / 2;
    graph.node(node).x = newNodeX;
  });
}

function markConflicts(graph: Graph, graphMatrix: NodeId[][]) {
  graph.edges().forEach((edge) => {
    graph.setEdge(edge, { conflicted: false });
  });

  for (let i = 1; i < graphMatrix.length - 1; i++) {
    const layer = graphMatrix[i + 1];
    let predecessor0Index = 0;
    let node1Index = 1;

    for (let j = 0; j < layer.length; j++) {
      const node0 = layer[j];
      if (j === layer.length - 1 || graph.node(node0).isDummyNode) {
        let predecessor1Index = graphMatrix[i].length - 1;

        if (graph.node(node0).isDummyNode) {
          const predecessor = graph.predecessors(node0)![0];
          predecessor1Index = graphMatrix[i].indexOf(predecessor);
        }

        while (node1Index <= j) {
          const node1 = layer[node1Index];
          const predecessors = graph.predecessors(node1) || [];

          for (let k = 0; k < predecessors.length; k++) {
            const predecessor = predecessors[k];

            if (k < predecessor0Index || k > predecessor1Index) {
              graph.setEdge(predecessor, node1, { conflicted: true }); // TODO: check if this overwrites vital info
            }
          }

          node1Index++;
        }

        predecessor0Index = predecessor1Index;
      }
    }
  }
}

function alignVertically(
  graph: Graph,
  graphMatrix: NodeId[][],
  iterationOrder: Ordering
) {
  const orderings = iterationOrder.split(" ");
  const leftBias = orderings[0] === "left-right";
  const topBias = orderings[1] === "top-bottom";

  graph.nodes().forEach((node) => {
    appendNodeValues(graph, node, { nextBlockNode: node, blockRoot: node });
  });

  for (
    let i = topBias ? 0 : graphMatrix.length - 1;
    topBias ? i < graphMatrix.length : i >= 0;
    topBias ? i++ : i--
  ) {
    const layer = graphMatrix[i];
    let lastNeighborIndex: number;

    if (leftBias) lastNeighborIndex = -1;
    else lastNeighborIndex = layer.length;

    for (
      let j = leftBias ? 0 : layer.length - 1;
      leftBias ? j < layer.length : j >= 0;
      leftBias ? j++ : j--
    ) {
      const node = layer[j];
      const neighbors = topBias
        ? graph.predecessors(node)!
        : graph.successors(node)!;

      if (neighbors.length) {
        const leftNeighborIndex = Math.floor(neighbors.length / 2);
        const rightNeighborIndex = Math.ceil(neighbors.length / 2);

        for (
          let k = leftBias ? leftNeighborIndex : rightNeighborIndex;
          leftBias ? k <= rightNeighborIndex : k >= leftNeighborIndex;
          leftBias ? k++ : k--
        ) {
          if (graph.node(node).nextBlockNode === node && !!neighbors[k]) {
            const neighbor = neighbors[k];
            const edgeIsConflicted: boolean | undefined = graph.edge(
              topBias ? neighbor : node,
              topBias ? node : neighbor
            ).conflicted;
            const alignmentDoesNotOverlap = leftBias
              ? lastNeighborIndex < k
              : lastNeighborIndex > k;

            if (!edgeIsConflicted && alignmentDoesNotOverlap) {
              if (topBias) {
                const neighborRoot = graph.node(neighbor).blockRoot;

                appendNodeValues(graph, neighbor, { nextBlockNode: node });
                appendNodeValues(graph, node, {
                  blockRoot: neighborRoot,
                  nextBlockNode: neighborRoot,
                });
              } else {
                const nodeRoot = graph.node(node).blockRoot;

                appendNodeValues(graph, node, { nextBlockNode: neighbor });
                appendNodeValues(graph, neighbor, {
                  blockRoot: nodeRoot,
                  nextBlockNode: nodeRoot,
                });
              }

              lastNeighborIndex = k;
            }
          }
        }
      }
    }
  }
}

function compactHorizontally(
  graph: Graph,
  graphMatrix: NodeId[][],
  delta: number
) {
  graph.nodes().forEach((node) => {
    appendNodeValues(graph, node, { classSink: node, shift: Infinity });
  });

  graph.nodes().forEach((node) => {
    if (graph.node(node).blockRoot === node) {
      placeBlock(graph, graphMatrix, node, delta);
    }
  });

  graph.nodes().forEach((node) => {
    const vRoot = graph.node(node).blockRoot;
    const vRootSink = graph.node(vRoot).classSink;
    graph.node(node).x = graph.node(vRoot).x;

    if (graph.node(vRootSink).shift < Infinity) {
      graph.node(node).x += graph.node(vRootSink).shift;
    }
  });
}

function placeBlock(
  graph: Graph,
  graphMatrix: NodeId[][],
  node: NodeId,
  delta: number
) {
  if (graph.node(node).x === undefined) {
    appendNodeValues(graph, node, { x: 0 });
    let currentNode = node;

    do {
      const layerIndex = graphMatrix.findIndex((layer) =>
        layer.includes(currentNode)
      )!;
      const nodeIndex = graphMatrix[layerIndex].indexOf(currentNode);

      if (nodeIndex > 0) {
        const previousNode = graphMatrix[layerIndex][nodeIndex - 1];
        const previousNodeRoot = graph.node(previousNode).blockRoot;

        placeBlock(graph, graphMatrix, previousNodeRoot, delta);

        if (graph.node(node).classSink === node) {
          appendNodeValues(graph, node, {
            classSink: graph.node(previousNodeRoot).classSink,
          });
        }

        const nodeX = graph.node(node).x;
        const previousNodeX = graph.node(previousNodeRoot).x;

        if (
          graph.node(node).classSink !== graph.node(previousNodeRoot).classSink
        ) {
          const previousNodeSink = graph.node(previousNodeRoot).classSink;
          const shift = Math.min(
            graph.node(previousNodeSink).shift,
            nodeX - previousNodeX - delta
          );

          appendNodeValues(graph, previousNodeSink, { shift });
        } else {
          const newVX = Math.max(nodeX, previousNodeX + delta);
          graph.node(node).x = newVX;
        }
      }
      currentNode = graph.node(currentNode).nextBlockNode;
    } while (currentNode !== node);
  }
}
