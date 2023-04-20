import { Edge } from "graphlib";
import Graph from "./graph";
import { buildSimpleGraph, NodeId } from "./utils";

interface EdgeAndLabel extends Edge {
  label?: any;
}

/**
 * Removes cycles from the input graph and returns the modified edges. Note
 * that: the input graph is modified in place, cycles are broken by inverting an
 * edge in the cycle, and loops (edges with the same source and target) are
 * simply removed. The algorithm is heavily based on Eades et al.'s greedy cycle
 * removal.
 *
 * @see https://www.sciencedirect.com/science/article/abs/pii/002001909390079O
 * @remarks Run time at least as good as O(|V| + |E|).
 *
 * @param graph A graphlib graph object. Must be directed.
 * @returns The modified edges.
 */
export default function removeCycles(graph: Graph) {
  const graphCopy = buildSimpleGraph(graph);
  const { nodes0, nodes1 } = greedilyGetFS(graphCopy);
  const modifiedEdges = handleEdges(graph, nodes0, nodes1);

  return modifiedEdges;
}

/**
 * This is basically the main algorithm of Eades et al. It sorts nodes into two
 * sets in such a way that it imposes a partial linear ordering. As it is
 * greedy, it may not find the optimal solution, but it always implicitly
 * produces a feedback set (FS): the set of edges going "against the flow",
 * i.e., from `nodes1` to `nodes0`.
 * @private
 *
 * @param graph A graphlib graph object. Must be directed.
 * @returns Two node sets imposing a partial linear ordering.
 */
export function greedilyGetFS(graph: Graph) {
  const nodes0: NodeId[] = [];
  const nodes1: NodeId[] = [];

  while (graph.nodeCount() > 0) {
    let remainingSinks = graph.sinks();
    while (remainingSinks.length > 0) {
      const sink = remainingSinks[0];
      graph.removeNode(sink);
      nodes1.push(sink);
      remainingSinks = graph.sinks();
    }

    let remainingSources = graph.sources();
    while (remainingSources.length > 0) {
      const source = remainingSources[0];
      graph.removeNode(source);
      nodes0.push(source);
      remainingSources = graph.sources();
    }

    if (graph.nodeCount() > 0) {
      const maxNode = getMaxNode(graph);
      graph.removeNode(maxNode);
      nodes0.push(maxNode);
    }
  }

  return { nodes0, nodes1 };
}

/**
 * @private
 *
 * @param graph A graphlib graph object. Must be directed.
 * @returns The node with the highest indegree - outdegree.
 */
export function getMaxNode(graph: Graph) {
  let maxNode = { nodeId: "", degree: -Infinity };

  graph.nodes().forEach((nodeId) => {
    const outEdges = graph.outEdges(nodeId) || [];
    const inEdges = graph.inEdges(nodeId) || [];
    const degree = outEdges.length - inEdges.length;

    if (degree > maxNode.degree) {
      maxNode = { nodeId, degree };
    }
  });

  return maxNode.nodeId;
}

/**
 * @private
 *
 * @param graph A graphlib graph object. Must be directed.
 * @param nodes0 The first set of nodes.
 * @param nodes1 The second set of nodes.
 * @returns The modified edges.
 */
export function handleEdges(graph: Graph, nodes0: NodeId[], nodes1: NodeId[]) {
  const deletedLoops: EdgeAndLabel[] = [];
  const reversedEdges: EdgeAndLabel[] = [];

  for (const edge of graph.edges()) {
    const deletedLoop = deleteLoop(graph, edge);
    if (deletedLoop) {
      deletedLoops.push(deletedLoop);
      continue;
    }

    const reversedEdge = reverseEdge(graph, nodes0, nodes1, edge);
    if (reversedEdge) reversedEdges.push(reversedEdge);
  }

  return { deletedLoops, reversedEdges };
}

/**
 * @private
 *
 * @param graph A graphlib graph object.
 * @param edge An edge.
 * @returns The original edge if it was a loop, `undefined` otherwise.
 */
export function deleteLoop(graph: Graph, edge: Edge) {
  const { v, w } = edge;

  if (v === w) {
    const edgeValue = graph.edge(edge);
    const originalEdge = { ...edge, value: edgeValue };

    graph.removeEdge(edge);
    return originalEdge;
  }
}

/**
 * @private
 *
 * @param graph A graphlib graph object.
 * @param nodes0 The first set of nodes.
 * @param nodes1 The second set of nodes.
 * @param edge An edge.
 * @returns The original edge if it was reversed, `undefined` otherwise.
 */
export function reverseEdge(
  graph: Graph,
  nodes0: NodeId[],
  nodes1: NodeId[],
  edge: Edge
) {
  const { v, w } = edge;

  if (nodes1.includes(v) && nodes0.includes(w)) {
    const edgeValue = graph.edge(edge);
    const originalEdge = { ...edge, value: edgeValue };
    const reversedEdge = { ...edge, v: w, w: v };

    graph.removeEdge(edge);
    graph.setEdge(reversedEdge, edgeValue);
    return originalEdge;
  }
}
