import Graph from "./graph";
import removeCycles from "./remove-cycles";
import layerNodes from "./layer-nodes";
import minimiseCrossings from "./minimise-crossings";
import straightenEdges from "./straighten-edges";
import { buildLayoutGraph, updateInputGraph } from "./utils";
import drawBezierCurves from "./draw-bezier-curves";

/**
 * Produces a hierarchical layout for the input graph, which must be directed.
 * Assigns layout information to the input graph and returns nothing.
 *
 * @remarks
 *
 * This algorithm is based on the Sugiyama method. It generates a layered graph
 * layout through four steps:
 *   1. Remove cycles
 *   2. Layer nodes
 *   3. Minimise crossings
 *   4. Straighten edges
 *
 * Each step uses specific sub-algorithms. Various changes have been made to the
 * original algorithms to support argument maps.
 *
 * @see {@link https://ieeexplore.ieee.org/document/4308636}
 *
 * @param graph A graph object. Must be directed.
 */
function layOutGraph(graph: Graph) {
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

  // Remove dummy nodes
  const dummyNodes = layoutGraph
    .nodes()
    .filter((node) => layoutGraph.node(node)?.isDummyNode);
  dummyNodes.forEach((node) => {
    const parent = layoutGraph.predecessors(node)![0];
    const child = layoutGraph.successors(node)![0];
    const edgeData = layoutGraph.node(node).edgeData;
    const inEdgePoints = layoutGraph.edge(parent, node).points;
    const outEdgePoints = layoutGraph.edge(node, child).points;
    const newPoints = [inEdgePoints[0], inEdgePoints[2], outEdgePoints[2]];

    layoutGraph.removeNode(node);
    layoutGraph.setEdge(parent, child, { ...edgeData, points: newPoints });
  });

  // Restore original edges
  originalEdges.deletedLoops.forEach((edge) => {
    const { v, w, label, name } = edge;
    layoutGraph.setEdge(v, w, label, name);
  });
  originalEdges.reversedEdges.forEach((edge) => {
    const { v, w, label, name } = edge;
    const edgeData = layoutGraph.edge(w, v);
    layoutGraph.removeEdge(w, v);
    layoutGraph.setEdge(v, w, { ...label, ...edgeData }, name);
  });

  updateInputGraph(graph, layoutGraph);
}

export default layOutGraph;
