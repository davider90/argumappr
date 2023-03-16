import { Graph } from "graphlib";

export type NodeId = string;

export class RankTable {
  private nodeToRank: Map<NodeId, number>;
  private rankToNode: Map<number, Map<NodeId, true>>;

  constructor() {
    this.nodeToRank = new Map();
    this.rankToNode = new Map();
  }

  set(node: NodeId, rank: number) {
    const oldRankNumber = this.getRankNumber(node);
    const existingRankEntries = this.getRankNodes(rank);

    if (!!oldRankNumber) {
      const oldRank = this.getRankNodes(oldRankNumber)!;
      oldRank.delete(node);
    }

    if (!!existingRankEntries) {
      existingRankEntries!.set(node, true);
    } else {
      const newRankEntry = new Map<NodeId, true>([[node, true]]);
      this.rankToNode.set(rank, newRankEntry);
    }

    this.nodeToRank.set(node, rank);
  }

  getRankNumber(node: NodeId) {
    return this.nodeToRank.get(node);
  }

  getRankNodes(rank: number) {
    return this.rankToNode.get(rank);
  }

  getSize() {
    return this.nodeToRank.size;
  }

  getSmallestRank() {
    return Math.min(...this.rankToNode.keys());
  }
}

/**
 * The following code block contains code derived from the dagre project, which
 * can be found at https://github.com/dagrejs/dagre. Dagre is licensed under the
 * MIT license. Therefore, the following copyright notice is included:
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

const graphNumAttrs = ["nodesep", "edgesep", "ranksep", "marginx", "marginy"];
const graphDefaults = { ranksep: 50, edgesep: 20, nodesep: 50, rankdir: "tb" };
const graphAttrs = ["acyclicer", "ranker", "rankdir", "align"];
const nodeNumAttrs = ["width", "height"];
const nodeDefaults = { width: 0, height: 0 };
const edgeNumAttrs = ["minlen", "weight", "width", "height", "labeloffset"];
const edgeDefaults = {
  minlen: 1,
  weight: 1,
  width: 0,
  height: 0,
  labeloffset: 10,
  labelpos: "r",
};
const edgeAttrs = ["labelpos"];

export function updateInputGraph(inputGraph: Graph, layoutGraph: Graph) {
  inputGraph.nodes().forEach((node) => {
    const inputLabel = inputGraph.node(node);
    const layoutLabel = layoutGraph.node(node);

    if (inputLabel) {
      inputLabel.x = layoutLabel.x;
      inputLabel.y = layoutLabel.y;

      if (layoutGraph.children(node).length) {
        inputLabel.width = layoutLabel.width;
        inputLabel.height = layoutLabel.height;
      }
    }
  });

  inputGraph.edges().forEach((edge) => {
    const inputLabel = inputGraph.edge(edge);
    const layoutLabel = layoutGraph.edge(edge);

    inputLabel.points = layoutLabel.points;
    if (!!layoutLabel?.x) {
      inputLabel.x = layoutLabel.x;
      inputLabel.y = layoutLabel.y;
    }
  });

  const inputGraphLabel = inputGraph.graph() as any;
  const layoutGraphLabel = layoutGraph.graph() as any;

  inputGraphLabel.width = layoutGraphLabel.width;
  inputGraphLabel.height = layoutGraphLabel.height;
}

export function buildLayoutGraph(inputGraph: Graph) {
  const layoutGraph = new Graph({ multigraph: true, compound: true });
  // const graph = canonicalize(inputGraph.graph());

  layoutGraph.setGraph(
    _.merge(
      {},
      graphDefaults,
      selectNumberAttrs(graph, graphNumAttrs),
      _.pick(graph, graphAttrs)
    )
  );

  _.forEach(inputGraph.nodes(), function (v) {
    const node = canonicalize(inputGraph.node(v));
    layoutGraph.setNode(
      v,
      _.defaults(selectNumberAttrs(node, nodeNumAttrs), nodeDefaults)
    );
    layoutGraph.setParent(v, inputGraph.parent(v));
  });

  _.forEach(inputGraph.edges(), function (e) {
    const edge = canonicalize(inputGraph.edge(e));
    layoutGraph.setEdge(
      e,
      _.merge(
        {},
        edgeDefaults,
        selectNumberAttrs(edge, edgeNumAttrs),
        _.pick(edge, edgeAttrs)
      )
    );
  });

  return layoutGraph;
}

// -----------------------------------------------------------------------------
