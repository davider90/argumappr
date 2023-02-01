import { Edge, Graph, json } from "graphlib";

const { read, write } = json;

export default function removeCycles(graph: Graph) {
  const graphCopy = read(write(graph));
  const { sources, sinks } = greedilyGetFS(graphCopy);
  const originalEdges = reverseEdges(graph, sources, sinks);

  return originalEdges;
}

export function greedilyGetFS(graph: Graph) {
  const sources: string[] = [];
  const sinks: string[] = [];

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

export function reverseEdges(graph: Graph, sources: string[], sinks: string[]) {
  const originalEdges: Edge[] = [];

  graph.edges().forEach((edge) => {
    const { v, w } = edge;

    if (sources.includes(v) && sinks.includes(w)) {
      const edgeValue = graph.edge(edge);
      const reversedEdge = { ...edge, v: w, w: v };

      graph.removeEdge(edge);
      originalEdges.push(edge);
      graph.setEdge(reversedEdge, edgeValue);
    }
  });

  return originalEdges;
}
