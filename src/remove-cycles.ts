import { Edge, Graph } from "graphlib";

export default function removeCycles(graph: Graph) {
  const edges = [...graph.edges()];
  const { sources, sinks } = greedilyGetFS(graph);
  graph.setNodes([...sources, ...sinks]);
  const originalEdges = reverseEdges(graph, edges, sources, sinks);

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

export function reverseEdges(
  graph: Graph,
  edges: Edge[],
  sources: string[],
  sinks: string[]
) {
  const originalEdges: Edge[] = [];

  edges.forEach((edge) => {
    const { v, w } = edge;
    if (sources.includes(v) && sinks.includes(w)) {
      graph.setEdge({ ...edge, v: w, w: v });
      originalEdges.push(edge);
    } else {
      graph.setEdge(edge);
    }
  });

  return originalEdges;
}
