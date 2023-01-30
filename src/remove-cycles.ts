import { Edge, Graph } from "graphlib";

function removeCycles(graph: Graph) {
  const { sources, sinks } = greedilyGetFS(graph);
  const originalEdges = reverseEdges(graph, sources, sinks);

  return originalEdges;
}

function greedilyGetFS(graph: Graph) {
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
      sources.push(source);
      graph.removeNode(source);
      remainingSources = graph.sources();
    }

    if (graph.nodeCount() > 0) {
      const maxNode = getMaxNode(graph);
      sources.push(maxNode);
      graph.removeNode(maxNode);
    }
  }

  return { sources, sinks };
}

function getMaxNode(graph: Graph) {
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

function reverseEdges(graph: Graph, sources: string[], sinks: string[]) {
  const originalEdges: Edge[] = [];

  graph.edges().forEach((edge) => {
    const { v, w } = edge;
    if (sources.includes(v) && sinks.includes(w)) {
      originalEdges.push(edge);
      graph.removeEdge(edge);
      graph.setEdge(w, v);
    }
  });

  return originalEdges;
}

export default removeCycles;
