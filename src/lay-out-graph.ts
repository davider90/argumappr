import Graph from "./graph.js";
import removeCycles from "./remove-cycles.js";
import layerNodes from "./layer-nodes.js";
import minimiseCrossings from "./minimise-crossings.js";
import straightenEdges from "./straighten-edges.js";
import { buildLayoutGraph, updateInputGraph } from "./utils.js";
import drawBezierCurves from "./draw-bezier-curves.js";

/**
 * Produces a hierarchical layout for the input graph, which must be directed.
 * Assigns layout information to the input graph and returns nothing.
 *
 * @remarks
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
 * @see
 * [Methods for VisualUnderstanding of Hierarchical System Structures](https://ieeexplore.ieee.org/document/4308636)
 *
 * @param graph A graph object. Must be directed.
 */
export default function layOutGraph(graph: Graph) {
  if (!graph.isDirected()) {
    throw new Error("Graph must be directed for layered drawing");
  }

  const layoutGraph = buildLayoutGraph(graph);

  // Primary algorithm steps
  const originalEdges = removeCycles(layoutGraph); // Step 1
  const ranks = layerNodes(layoutGraph); // Step 2
  const graphMatrix = minimiseCrossings(layoutGraph, ranks); // Step 3
  straightenEdges(layoutGraph, graphMatrix); // Step 4

  restoreEdges(layoutGraph, originalEdges);
  finaliseWarrantPositions(layoutGraph);
  drawBezierCurves(layoutGraph);
  removeDummyNodes(layoutGraph);

  updateInputGraph(graph, layoutGraph);
}

/**
 * Restores the graph to its original state by reverting the changes made during
 * cycle removal.
 *
 * @param graph A graph object.
 * @param originalEdges Original edges of the graph.
 */
function restoreEdges(
  graph: Graph,
  originalEdges: ReturnType<typeof removeCycles>
) {
  originalEdges.deletedLoops.forEach((edge) => {
    const { v, w, label, name } = edge;
    graph.setEdge(v, w, label, name);
  });
  originalEdges.reversedEdges.forEach((edge) => {
    const { v, w, label, name } = edge;
    const edgeData = graph.edge(w, v);
    graph.removeEdge(w, v);
    graph.setEdge(v, w, { ...label, ...edgeData }, name);
  });
}

/**
 * Removes from the graph the *long edge dummy nodes* produced during crossing
 * minimisation.
 *
 * @param graph A graph object.
 */
function removeDummyNodes(graph: Graph) {
  const dummyNodes = graph
    .nodes()
    .filter((node) => graph.node(node)?.isDummyNode);
  dummyNodes.forEach((node) => {
    const parent = graph.predecessors(node)![0];
    const child = graph.successors(node)![0];
    const edgeData = graph.node(node).edgeData;
    const inEdgePoints = graph.edge(parent, node).points;
    const outEdgePoints = graph.edge(node, child).points;
    const newPoints = [inEdgePoints[0], inEdgePoints[2], outEdgePoints[2]];

    graph.removeNode(node);
    graph.setEdge(parent, child, { ...edgeData, points: newPoints });
  });
}

/**
 * Removes dummy warrant nodes, re-adds the original warrant nodes and sets them
 * to their final positions.
 *
 * @param graph A graph object.
 */
function finaliseWarrantPositions(graph: Graph) {
  const warrantDummySources = graph
    .nodes()
    .filter((node) => graph.node(node).isWarrantDummySource);

  warrantDummySources.forEach((node) => {
    const nodeLabel = graph.node(node);
    const { source, sink } = nodeLabel.warrantNodes;
    const targetSource = sink.id.split(" -> ")[0];
    const targetEdgeX = graph.node(targetSource).x;

    graph.setNode(source.id, { ...source.label, x: nodeLabel.x });
    graph.setNode(sink.id, { ...sink.label, x: targetEdgeX });
  });
}
