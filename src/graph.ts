import { Edge, Graph as graphlibGraph, GraphOptions } from "graphlib";
import { NodeId } from "./utils";

/**
 * Provides a graph data structure that extents graphlib's and adds support for
 * warrant edges and conjunct nodes.
 */
export default class Graph extends graphlibGraph {
  /**
   * @param options Booleans for setting the graph as directed (default true),
   * multigraph (default false) and compound (default true).
   */
  constructor(options?: GraphOptions) {
    super({ compound: true, ...options });
  }

  // Overrides erroneous return type.
  override graph(): any {
    return super.graph();
  }

  /**
   * Creates a new conjunct node based on an existing simple connection or
   * appends `node` to an existing conjunct node.
   *
   * @param node The node to add to the conjunct node.
   * @param edge The edge going from the conjunct node.
   * @returns The graph, allowing this to be chained with other functions.
   */
  setConjunctNode(node: NodeId, edge: Edge) {
    let vParentNode = this.parent(edge.v);

    if (!vParentNode) {
      vParentNode = `-> ${edge.w}`;

      this.setNode(vParentNode, { isConjunctNode: true });
      this.setParent(edge.v, vParentNode);

      const edgeLabel = this.edge(edge) || {};

      this.setEdge(vParentNode, edge.w, edgeLabel, edge.name);
      this.removeEdge(edge);
    }

    this.setParent(node, vParentNode);

    return this;
  }

  /**
   * Creates a new warrant edge or updates the label of an existing one.
   *
   * @param sourceNode The source node of the warrant edge.
   * @param targetEdge The target edge of the warrant edge.
   * @param label Value to associate with the edge.
   * @param name Unique name for the edge (for multigraphs).
   * @returns The graph, allowing this to be chained with other functions.
   */
  setWarrantEdge(
    sourceNode: string,
    targetEdge: Edge,
    label?: any,
    name?: string
  ) {
    const dummyNodeId = `${targetEdge.v} -> ${targetEdge.w}`;

    if (this.hasEdge(sourceNode, dummyNodeId)) {
      if (label) this.edge(sourceNode, dummyNodeId, name).label = label;
      return this;
    }

    this.setNode(dummyNodeId, { isWarrantSink: true, width: 0, height: 0 });
    const edgeLabel =
      label || (this as any)._defaultEdgeLabelFn(sourceNode, dummyNodeId, name);
    this.setEdge(sourceNode, dummyNodeId, edgeLabel, name);

    return this;
  }

  /**
   * @param v Either the edge to be removed or the ID of the source node.
   * @param wAndName Should be `w: string, name?: string` if `v` is not `Edge`.
   * @returns The graph, allowing this to be chained with other functions.
   */
  override removeEdge(v: NodeId | Edge, ...wAndName: string[]) {
    let _v: NodeId;
    let _w: NodeId;
    let _name: string | undefined;

    if (wAndName.length) {
      _v = v as NodeId;
      [_w, _name] = wAndName;
    } else {
      const edge = v as Edge;
      _v = edge.v;
      _w = edge.w;
      _name = edge.name;
    }

    if (this.node(_v)?.isConjunctNode) {
      this.removeNode(_v);
    } else if (this.node(_w)?.isWarrantSink) {
      this.removeNode(_w);
    }

    const possibleWarrantSink = `${_v} -> ${_w}`;

    if (this.hasNode(possibleWarrantSink)) {
      const warrantSource = this.predecessors(possibleWarrantSink)![0];
      this.removeNode(possibleWarrantSink);
      this.node(warrantSource).isWarrantSource = false;
    }

    super.removeEdge(_v, _w, _name);

    return this;
  }
}
