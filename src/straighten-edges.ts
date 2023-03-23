import { Graph } from "graphlib";
import { NodeId, appendNodeValues, buildSimpleGraph } from "./utils";

export default function straightenEdges(graph: Graph, graphMatrix: NodeId[][]) {
  const leftTopBiasedGraph = buildSimpleGraph(graph);
  const leftTopBiasedGraph = buildSimpleGraph(graph);
  const leftTopBiasedGraph = buildSimpleGraph(graph);
  const leftTopBiasedGraph = buildSimpleGraph(graph);

  markConflicts(graphMatrix);
}

function markConflicts(graphMatrix: NodeId[][]) {
  for (let i = 1; i < graphMatrix.length - 1; i++) {
    const L_i1 = graphMatrix[i + 1];
    let k_0 = 0;
    let l = 1;

    for (let l_1 = 0; l_1 < L_i1.length; l_1++) {
      const v_l1 = L_i1[l_1];
      if (
        l_1 === L_i1.length - 1 ||
        false // TODO: check if v_l1 is a dummy node
      ) {
        let k_1 = graphMatrix[i].length - 1;

        if (
          false // TODO: check if v_l1 is a dummy node
        ) {
          const { v } = { v: "" }; // TODO: get parent of v_l1
          k_1 = graphMatrix[i].indexOf(v);
        }

        while (l <= l_1) {
          const v_l = L_i1[l];
          const predecessors: NodeId[] = []; // TODO: get predecessors of v_l in L_i

          for (let k = 0; k < predecessors.length; k++) {
            const v_k = predecessors[k];

            if (k < k_0 || k > k_1) {
              // TODO: mark ( v_k, v_l ) as a type 1 conflict
            }
          }
          l++;
        }
        k_0 = k_1;
      }
    }
  }
}

type Ordering =
  | "left-right top-bottom"
  | "right-left top-bottom"
  | "left-right bottom-top"
  | "right-left bottom-top";

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
    const layer_i = graphMatrix[i];
    let r = 0;

    for (
      let j = leftBias ? 0 : layer_i.length - 1;
      leftBias ? j < layer_i.length : j >= 0;
      leftBias ? j++ : j--
    ) {
      // TODO: continue bias implementation from here
      const v_j = layer_i[j];
      const predecessors: NodeId[] = []; // TODO: get predecessors of v_j in layer i-1

      if (!!predecessors) {
        const start = Math.floor(predecessors.length / 2);
        const end = Math.ceil(predecessors.length / 2);

        for (let k = start; k <= end; k++) {
          if (graph.node(v_j).nextBlockNode === v_j) {
            const u_k = predecessors[k];
            const edgeIsMarked: boolean = graph.edge(u_k, v_j).marked;

            if (!edgeIsMarked && r <= k) {
              const u_kRoot = graph.node(u_k).blockRoot;

              appendNodeValues(graph, u_k, { nextBlockNode: v_j });
              appendNodeValues(graph, v_j, { blockRoot: u_kRoot });
              appendNodeValues(graph, v_j, { nextBlockNode: u_kRoot });
              r = k;
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
  iterationOrder: Ordering,
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
  v: NodeId,
  delta: number
) {
  if (graph.node(v).x === undefined) {
    appendNodeValues(graph, v, { x: 0 });
    let w = v;

    do {
      const w_pos = 0; // TODO: get position of w in its layer

      if (w_pos > 0) {
        const wLayer = 0; // TODO: get layer of w
        const nodeBeforeW = graphMatrix[w][w_pos - 1];
        const u = graph.node(nodeBeforeW).blockRoot;

        placeBlock(graph, graphMatrix, u, delta);

        if (graph.node(v).classSink === v) {
          appendNodeValues(graph, v, { classSink: graph.node(u).classSink });
        }

        if (graph.node(v).classSink !== graph.node(u).classSink) {
          const uSink = graph.node(u).classSink;
          const vX = graph.node(v).x;
          const uX = graph.node(u).x;
          const shift = Math.min(graph.node(uSink).shift, vX - uX - delta);

          appendNodeValues(graph, uSink, { shift });
        } else {
          const vX = graph.node(v).x;
          const uX = graph.node(u).x;
          const newVX = Math.max(vX, uX + delta);

          graph.node(v).x = newVX;
        }

        w = graph.node(nodeBeforeW).nextBlockNode;
      }
    } while (w !== v);
  }
}
