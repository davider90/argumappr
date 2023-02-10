import { Edge, Graph, json } from "graphlib";

const { read, write } = json;

type NodeId = string;

export default function removeCycles(graph: Graph) {
  const graphCopy = read(write(graph));
  const { sources, sinks } = greedilyGetFS(graphCopy);
  const modifiedEdges = handleEdges(graph, sources, sinks);

  return modifiedEdges;
}

export function greedilyGetFS(graph: Graph) {
  const sources: NodeId[] = [];
  const sinks: NodeId[] = [];

  while (graph.nodeCount() > 0) {
    let remainingSinks = graph.sinks();
    while (remainingSinks.length > 0) {
      const sink = remainingSinks[0];
      graph.removeNode(sink);
      sinks.push(sink);
      remainingSinks = graph.sinks();
    }

    let remainingSources = graph.sources();
    while (remainingSources.length > 0) {
      const source = remainingSources[0];
      graph.removeNode(source);
      sources.push(source);
      remainingSources = graph.sources();
    }

    if (graph.nodeCount() > 0) {
      const maxNode = getMaxNode(graph);
      graph.removeNode(maxNode);
      sources.push(maxNode);
    }
  }

  return { sources, sinks };
}

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

export function handleEdges(graph: Graph, sources: NodeId[], sinks: NodeId[]) {
  const deletedLoops: Edge[] = [];
  const reversedEdges: Edge[] = [];

  for (const edge of graph.edges()) {
    const deletedLoop = deleteLoop(graph, edge);
    if (!!deletedLoop) {
      deletedLoops.push(deletedLoop);
      continue;
    }

    const reversedEdge = reverseEdge(graph, sources, sinks, edge);
    if (!!reversedEdge) reversedEdges.push(reversedEdge);
  }

  return { deletedLoops, reversedEdges };
}

export function deleteLoop(graph: Graph, edge: Edge) {
  const { v, w } = edge;

  if (v === w) {
    const edgeValue = graph.edge(edge);
    const originalEdge = { ...edge, value: edgeValue };

    graph.removeEdge(edge);
    return originalEdge;
  }
}

export function reverseEdge(
  graph: Graph,
  sources: NodeId[],
  sinks: NodeId[],
  edge: Edge
) {
  const { v, w } = edge;

  if (sources.includes(v) && sinks.includes(w)) {
    const edgeValue = graph.edge(edge);
    const originalEdge = { ...edge, value: edgeValue };
    const reversedEdge = { ...edge, v: w, w: v };

    graph.removeEdge(edge);
    graph.setEdge(reversedEdge, edgeValue);
    return originalEdge;
  }
}
