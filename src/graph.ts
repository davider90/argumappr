import { Edge, Graph as graphlibGraph, GraphOptions } from "graphlib";
import { appendNodeValues, NodeId } from "./utils";

/**
 * Provides a graph data structure that extents graphlib's and adds support for
 * relevance edges and conjunct nodes.
 */
class Graph extends graphlibGraph {
  constructor(options?: GraphOptions) {
    super(options);
  }

  // Overrides erroneous return type.
  override graph(): any {
    return super.graph();
  }

  setRelevanceEdge(
    sourceNode: string,
    targetEdge: Edge,
    label?: any,
    name?: string
  ) {
    const sourceNodeData = {
      ...this.node(sourceNode),
      isRelevanceSource: true,
    };
    const dummyNodeId = `${targetEdge.v} -> ${targetEdge.w}`;

    appendNodeValues(this, sourceNode, sourceNodeData);
    this.setNode(dummyNodeId, { isRelevanceSink: true });
    this.setEdge(sourceNode, dummyNodeId, label, name);

    return this;
  }

  /**
   * @param v Either the edge to be removed or the ID of the source node.
   * @param wAndName Should be `w: string, name?: string` if `v` is not `Edge`.
   * @returns The graph, allowing this to be chained with other functions.
   */
  override removeEdge(v: NodeId | Edge, ...wAndName: string[]) {
    if (wAndName.length) {
      const sourceNode = v as NodeId;
      const [w, name] = wAndName as [NodeId, string];

      if (this.node(w)?.isRelevanceNode) this.removeNode(w);
      else super.removeEdge(sourceNode, w, name);
    } else {
      const edge = v as Edge;

      if (this.node(edge.w)?.isRelevanceNode) this.removeNode(edge.w);
      else super.removeEdge(edge);
    }

    return this;
  }

  setConjunctNode(node: NodeId, edge: Edge) {
    let vParentNode = this.parent(edge.v);

    if (!vParentNode) {
      vParentNode = `-> ${edge.w}`;
      this.setNode(vParentNode, { isConjunctNode: true });
    }

    this.setParent(node, vParentNode);
    this.setEdge(node, edge.w);

    return this;
  }
}

export default Graph;
