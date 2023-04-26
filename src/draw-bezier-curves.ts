import Graph from "./graph";

/**
 * @see https://javascript.info/bezier-curve
 *
 * @param graph A graphlib graph object.
 */
function drawBezierCurves(graph: Graph) {
  graph.edges().forEach((edge) => {
    const { v, w } = edge;
    const numberOfVEdges = graph.nodeEdges(v)!.length;

    const controlPoint0 = {
      x: graph.node(v).x,
      y: graph.node(v).y,
    };
    const controlPoint1 = {
      x: numberOfVEdges > 1 ? graph.node(w).x : graph.node(v).x,
      y: numberOfVEdges > 1 ? graph.node(v).y : graph.node(w).y,
    };
    const controlPoint2 = {
      x: graph.node(w).x,
      y: graph.node(w).y,
    };

    function line01(t: number) {
      return {
        x: (1 - t) * controlPoint0.x + t * controlPoint1.x,
        y: (1 - t) * controlPoint0.y + t * controlPoint1.y,
      };
    }
    function line12(t: number) {
      return {
        x: (1 - t) * controlPoint1.x + t * controlPoint2.x,
        y: (1 - t) * controlPoint1.y + t * controlPoint2.y,
      };
    }
    function connectingLine(t: number) {
      const point01 = line01(t);
      const point12 = line12(t);

      return {
        x: (1 - t) * point01.x + t * point12.x,
        y: (1 - t) * point01.y + t * point12.y,
      };
    }

    const points = [controlPoint0, connectingLine(0.5), controlPoint2];
    const edgeData = graph.edge(edge);

    if (edgeData) {
      graph.edge(edge).points = points;
    } else {
      graph.setEdge(edge, { points });
    }
  });
}

export default drawBezierCurves;
