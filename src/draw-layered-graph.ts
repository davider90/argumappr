import Graph from "./graph";
import removeCycles from "./remove-cycles";
import layerNodes from "./layer-nodes";
import minimiseCrossings from "./minimise-crossings";
import straightenEdges from "./straighten-edges";
import { buildLayoutGraph, updateInputGraph } from "./utils";
import drawBezierCurves from "./draw-bezier-curves";

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

  // Primary algorithm steps
  const originalEdges = removeCycles(layoutGraph); // Step 1
  const ranks = layerNodes(layoutGraph); // Step 2
  const graphMatrix = minimiseCrossings(layoutGraph, ranks); // Step 3
  straightenEdges(layoutGraph, graphMatrix); // Step 4

  drawBezierCurves(layoutGraph);

  originalEdges.deletedLoops.forEach((edge) => {
    layoutGraph.setEdge(edge);
  });

  originalEdges.reversedEdges.forEach((edge) => {
    const { v, w } = edge;
    layoutGraph.removeEdge(v, w);
    layoutGraph.setEdge(w, v);
  });

  updateInputGraph(graph, layoutGraph);
}

export default drawLayeredGraph;
