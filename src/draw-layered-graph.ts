import eliminateCycles from "./eliminate-cycles";
import layerNodes from "./layer-nodes";
import minimiseCrossings from "./minimise-crossings";
import straightenEdges from "./straighten-edges";

function drawLayeredGraph(params: any) {
  const one = eliminateCycles(params);
  const two = layerNodes(one);
  const three = minimiseCrossings(two);
  const four = straightenEdges(three);

  return four;
}

export default drawLayeredGraph;
