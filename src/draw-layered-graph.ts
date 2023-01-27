import { Graph } from "graphlib";
import eliminateCycles from "./eliminate-cycles";
import layerNodes from "./layer-nodes";
import minimiseCrossings from "./minimise-crossings";
import straightenEdges from "./straighten-edges";

function drawLayeredGraph(graph: Graph) {
  if (!graph.isDirected()) {
    throw new Error("Graph must be directed for layered drawing");
  }

  const one = eliminateCycles(graph);
  const two = layerNodes(one);
  const three = minimiseCrossings(two);
  const four = straightenEdges(three);

  return four;
}

export default drawLayeredGraph;
