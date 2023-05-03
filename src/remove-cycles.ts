import { Edge } from "graphlib";
import Graph from "./graph";
import { buildSimpleGraph, EdgeAndLabel, NodeId } from "./utils";

/**
 * Removes cycles from the input graph by reversing edges and, in case of loops,
 * deleting edges. Returns the original version of all modified edges. Mutates
 * the input graph in place.
 *
 * @remarks
 * This algorithm is heavily based on Eades et al.'s greedy cycle removal. It
 * uses a greedy heuristic to identify a *small enough* set of edges whose
 * reversal leaves the graph acyclic. The edges of said set are inverted, and
 * loops are deleted. The original versions of modified edges are stored away
 * and returned so that they may be restored at a later stage. The run time is
 * at least as good as *O(|V| + |E|)*.
 *
 * @see
 * [A fast and effective heuristic for the feedback arc set problem](https://www.sciencedirect.com/science/article/abs/pii/002001909390079O)
 *
 * @param graph A graph object. Must be directed.
 * @returns The original version of all modified edges.
 */
export default function removeCycles(graph: Graph) {
  const graphCopy = buildSimpleGraph(graph);
  const { nodes0, nodes1 } = greedilyGetFS(graphCopy);
  const modifiedEdges = handleEdges(graph, nodes0, nodes1);

  return modifiedEdges;
}

/**
 * Greedily generates an implicit set of edges whose reversal leaves the graph
 * acyclic (all edges going from a node in `nodes1` to a node in `nodes0`)
 *
 * @remarks
 *
 * This is basically the main algorithm of Eades et al. It sorts nodes into two
 * sets in such a way that it imposes a partial linear ordering. As it is
 * greedy, it may not find the optimal solution, but it always implicitly
 * produces a feedback set (FS): the set of edges going *against the flow*,
 * i.e., from `nodes1` to `nodes0`.
 *
 * @param graph A graph object. Must be directed.
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
 * Returns the node of maximum degree. In this context, *degree* is defined as
 * the difference between the outdegree and the indegree of a node.
 *
 * @param graph A graph object. Must be directed.
 * @returns The node with the highest degree.
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
 * Reverses edges whose tail is in `nodes0` and head is in `nodes1`, deletes
 * loops and returns the original version of all modified edges.
 *
 * @param graph A graph object. Must be directed.
 * @param nodes0 The first set of nodes.
 * @param nodes1 The second set of nodes.
 * @returns The original version of all modified edges.
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
 * If the edge is a loop, deletes it from the graph and returns it. Returns
 * `undefined` otherwise.
 *
 * @param graph A graph object.
 * @param edge An edge.
 * @returns The original edge if it was a loop.
 */
export function deleteLoop(graph: Graph, edge: Edge) {
  const { v, w } = edge;

  if (v === w) {
    const edgeLabel = graph.edge(edge);
    const originalEdge = { ...edge, label: edgeLabel };

    graph.removeEdge(edge);
    return originalEdge;
  }
}

/**
 * If the edge goes from `nodes1` to `nodes0`, reverses it in the graph and
 * returns the original edge. Returns `undefined` otherwise.
 *
 * @param graph A graph object. Must be directed.
 * @param nodes0 The first set of nodes.
 * @param nodes1 The second set of nodes.
 * @param edge An edge.
 * @returns The original edge if it was reversed.
 */
export function reverseEdge(
  graph: Graph,
  nodes0: NodeId[],
  nodes1: NodeId[],
  edge: Edge
) {
  const { v, w } = edge;

  if (nodes1.includes(v) && nodes0.includes(w)) {
    const edgeLabel = graph.edge(edge);
    const originalEdge = { ...edge, label: edgeLabel };
    const reversedEdge = { ...edge, v: w, w: v };

    graph.removeEdge(edge);
    graph.setEdge(reversedEdge, edgeLabel);
    return originalEdge;
  }
}
