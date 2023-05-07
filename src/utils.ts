import { Edge } from "graphlib";
import Graph from "./graph.js";

export type NodeId = string;
export interface EdgeAndLabel extends Edge {
  label?: any;
}

interface GraphProperties {
  graphProperties?: string[];
  nodeProperties?: string[];
  edgeProperties?: string[];
}

/**
 * Copies the input graph as simply as possible. Only if `properties` is
 * provided, will labels be considered, and then only specified properties
 * will be copied.
 *
 * @param graph A graph object.
 * @returns A simple copy of the graph.
 */
export function buildSimpleGraph(graph: Graph, properties?: GraphProperties) {
  const simpleGraph = new Graph();

  if (!properties) {
    graph.nodes().forEach((node) => {
      simpleGraph.setNode(node);
    });

    graph.edges().forEach((edge) => {
      simpleGraph.setEdge(edge);
    });

    return simpleGraph;
  }

  graph.nodes().forEach((node) => {
    const nodeData = graph.node(node);
    const simpleNodeData: { [key: string]: any } = {};

    properties.nodeProperties?.forEach((property) => {
      simpleNodeData[property] = nodeData[property];
    });

    simpleGraph.setNode(node, simpleNodeData);
  });

  graph.edges().forEach((edge) => {
    const edgeData = graph.edge(edge);
    const simpleEdgeData: { [key: string]: any } = {};

    properties.edgeProperties?.forEach((property) => {
      simpleEdgeData[property] = edgeData[property];
    });

    simpleGraph.setEdge(edge, simpleEdgeData);
  });

  simpleGraph.setGraph({});

  properties.graphProperties?.forEach((property) => {
    simpleGraph.graph()[property] = graph.graph()[property];
  });

  return simpleGraph;
}

/**
 * Provides a mapping between node IDs and their ranks.
 */
export class RankTable {
  private nodeToRank = new Map<NodeId, number>();
  private rankToNodes = new Map<number, Set<NodeId>>();

  set(node: NodeId, rank: number) {
    const oldRankIndex = this.getRank(node);

    if (rank === oldRankIndex) return;

    if (oldRankIndex !== undefined) {
      const oldRank = this.getNodes(oldRankIndex)!;

      oldRank.delete(node);
      if (oldRank.size === 0) this.rankToNodes.delete(oldRankIndex);
      this.nodeToRank.delete(node);
    }

    const rankEntries = this.getNodes(rank);

    if (rankEntries) {
      rankEntries.add(node);
    } else {
      this.rankToNodes.set(rank, new Set<NodeId>([node]));
    }

    this.nodeToRank.set(node, rank);
  }

  delete(node: NodeId) {
    const rankIndex = this.getRank(node);

    if (rankIndex === undefined) return;

    const rank = this.getNodes(rankIndex)!;

    rank.delete(node);
    if (rank.size === 0) this.rankToNodes.delete(rankIndex);
    this.nodeToRank.delete(node);
  }

  getRank(node: NodeId) {
    return this.nodeToRank.get(node);
  }

  getNodes(rank: number) {
    return this.rankToNodes.get(rank);
  }

  getMinRankIndex() {
    return Math.min(...this.rankToNodes.keys());
  }

  getMaxRankIndex() {
    return Math.max(...this.rankToNodes.keys());
  }
}

/**
 * Merges the subnodes of conjunct nodes into a single node with all inedges
 * and outedges of the subnodes. Stores away any labels for later restoration.
 *
 * @param graph A graph object.
 * @returns The conjunct nodes.
 */
export function mergeConjunctNodes(graph: Graph) {
  const conjunctNodes = graph
    .nodes()
    .filter((node) => graph.node(node).isConjunctNode);

  conjunctNodes.forEach((node) => {
    const originalEdges: EdgeAndLabel[] = [];
    const subnodeData: { [node: NodeId]: any } = {};
    const subnodes = graph.children(node);

    subnodes.forEach((subnode) => {
      const inEdges = graph.inEdges(subnode) || [];
      const outEdges = graph.outEdges(subnode) || [];

      inEdges.forEach((inEdge) => {
        const { v } = inEdge;
        const edgeLabel = graph.edge(inEdge);

        graph.setEdge(v, node, edgeLabel);
        originalEdges.push({ ...inEdge, label: edgeLabel });
      });

      outEdges.forEach((outEdge) => {
        const { w } = outEdge;
        const edgeLabel = graph.edge(outEdge);

        graph.setEdge(node, w, edgeLabel);
        originalEdges.push({ ...outEdge, label: edgeLabel });
      });

      subnodeData[subnode] = graph.node(subnode);
      graph.removeNode(subnode);
    });

    graph.node(node).subnodeData = subnodeData;
    graph.node(node).originalEdges = originalEdges;
  });

  return conjunctNodes;
}

/**
 * Splits conjunct nodes by restoring the subnodes and their edges. Provide a
 * rank table to set the ranks of the subnodes.
 *
 * @param graph A graph object.
 * @param conjunctNodes The merged conjunct nodes.
 * @param ranks An optional rank table.
 */
export function splitConjunctNodes(
  graph: Graph,
  conjunctNodes: NodeId[],
  ranks?: RankTable
) {
  conjunctNodes.forEach((node) => {
    const { subnodeData, originalEdges } = graph.node(node);

    Object.keys(subnodeData).forEach((subnode) => {
      graph.setNode(subnode, subnodeData[subnode]);
      graph.setParent(subnode, node);
      if (ranks) ranks.set(subnode, ranks.getRank(node)!);
    });

    originalEdges.forEach((edge: EdgeAndLabel) => {
      const { v, w, label, name } = edge;
      graph.setEdge(v, w, label, name);
    });

    const conjunctTarget = node.substring(3);

    for (const edge of graph.nodeEdges(node)!) {
      if (edge.w === conjunctTarget) continue;
      graph.removeEdge(edge);
    }
  });
}

/**
 * The following code block contains code derived from the dagre project, which
 * can be found at https://github.com/dagrejs/dagre. Dagre is licensed under the
 * MIT license. Therefore, the following copyright notice is included.
 *
 * Copyright (c) 2012-2014 Chris Pettitt
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
// -----------------------------------------------------------------------------

const GRAPH_DEFAULTS = {
  ranksep: 225,
  edgesep: 20, // Currently unused
  nodesep: 100,
  rankdir: "tb", // Currently unused
  maxrankingloops: 100,
  maxcrossingloops: 100,
};
const NODE_DEFAULTS = {
  width: 300,
  height: 100, // Currently unused
};
const EDGE_DEFAULTS = {
  minlen: 1,
  weight: 1, // Currently unused
  width: 0, // Currently unused
  height: 0, // Currently unused
  labeloffset: 10, // Currently unused
  labelpos: "r", // Currently unused
};

/**
 * Updates the input graph with the attributes of the layout graph.
 *
 * @param inputGraph A graph object.
 * @param layoutGraph A copied and laid out graph object.
 */
export function updateInputGraph(inputGraph: Graph, layoutGraph: Graph) {
  inputGraph.nodes().forEach((node) => {
    const inputLabel = inputGraph.node(node);
    const layoutLabel = layoutGraph.node(node);

    if (inputLabel) {
      inputLabel.x = layoutLabel.x;
      inputLabel.y = layoutLabel.y;

      inputLabel.width = layoutLabel.width;
      inputLabel.height = layoutLabel.height;
    }
  });

  inputGraph.edges().forEach((edge) => {
    const inputLabel = inputGraph.edge(edge);
    const layoutLabel = layoutGraph.edge(edge);

    inputLabel.points = layoutLabel.points;

    if (layoutLabel.x) {
      inputLabel.x = layoutLabel.x;
      inputLabel.y = layoutLabel.y;
    }
  });

  const inputGraphLabel = inputGraph.graph();
  const layoutGraphLabel = layoutGraph.graph();

  if (inputGraphLabel) {
    inputGraphLabel.width = layoutGraphLabel.width;
    inputGraphLabel.height = layoutGraphLabel.height;
  }
}

/**
 * Creates a new graph object, copies the input graph, adds default values for
 * missing attributes and returns the new graph.
 *
 * @param inputGraph A graph object.
 * @returns A new graph object for layouting.
 */
export function buildLayoutGraph(inputGraph: Graph) {
  const layoutGraph = new Graph({ directed: true, compound: true });
  const inputGraphLabel = inputGraph.graph() as any;

  layoutGraph.setGraph({ ...GRAPH_DEFAULTS, ...inputGraphLabel });

  inputGraph.nodes().forEach((node) => {
    const nodeLabel = inputGraph.node(node);
    const nodeParent = inputGraph.parent(node) as string | undefined;

    layoutGraph.setNode(node, { ...NODE_DEFAULTS, ...nodeLabel });
    layoutGraph.setParent(node, nodeParent);
  });

  inputGraph.edges().forEach((edge) => {
    const edgeLabel = inputGraph.edge(edge);

    layoutGraph.setEdge(edge, { ...EDGE_DEFAULTS, ...edgeLabel });
  });

  return layoutGraph;
}

// -----------------------------------------------------------------------------
