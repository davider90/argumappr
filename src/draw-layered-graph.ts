import { Graph } from "graphlib";
import removeCycles from "./remove-cycles";
import layerNodes from "./layer-nodes";
import minimiseCrossings from "./minimise-crossings";
import straightenEdges from "./straighten-edges";

function drawLayeredGraph(graph: Graph) {
  if (!graph.isDirected()) {
    throw new Error("Graph must be directed for layered drawing");
  }

  const one = removeCycles(graph);
  const two = layerNodes(one);
  const three = minimiseCrossings(two);
  const four = straightenEdges(three);

  return four;
}

export default drawLayeredGraph;
