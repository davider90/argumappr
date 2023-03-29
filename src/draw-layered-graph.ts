import { Graph } from "graphlib";
import removeCycles from "./remove-cycles";
import layerNodes from "./layer-nodes";
import minimiseCrossings from "./minimise-crossings";
import straightenEdges from "./straighten-edges";
import { buildLayoutGraph, updateInputGraph } from "./utils";

/**
 * Produces a hierarchical layout of a directed graph. The algorithm is based on
 * the Sugiyama method, producing a layered graph through four steps: removing
 * cycles, layering nodes, minimising edge crossings and straightening edges.
 *
 * @param graph A graphlib graph object. Must be directed.
 */
function drawLayeredGraph(graph: Graph) {
  if (!graph.isDirected()) {
    throw new Error("Graph must be directed for layered drawing");
  }

  const layoutGraph = buildLayoutGraph(graph);

  const originalEdges = removeCycles(layoutGraph);
  const ranks = layerNodes(layoutGraph);
  const graphMatrix = minimiseCrossings(layoutGraph, ranks);
  straightenEdges(layoutGraph, graphMatrix);

  originalEdges.deletedLoops.forEach((edge) => {
    layoutGraph.setEdge(edge);
  });

  originalEdges.reversedEdges.forEach((edge) => {
    const { v, w } = edge;
    layoutGraph.removeEdge(v, w);
    layoutGraph.setEdge(w, v);
  });

  layoutGraph.edges().forEach((edge) => {
    const { v, w } = edge;
    const vData = layoutGraph.node(v);
    const wData = layoutGraph.node(w);
    const edgeData = layoutGraph.edge(v, w);
    layoutGraph.setEdge(edge, {
      ...edgeData,
      points: [
        { x: vData.x, y: vData.y },
        { x: (vData.x + wData.x) / 2, y: (vData.y + wData.y) / 2 },
        { x: wData.x, y: wData.y },
      ],
    });
  });

  updateInputGraph(graph, layoutGraph);
}

export default drawLayeredGraph;
