import { Graph } from "graphlib";

// const graphNumAttrs = ["nodesep", "edgesep", "ranksep", "marginx", "marginy"];
// const graphDefaults = { ranksep: 50, edgesep: 20, nodesep: 50, rankdir: "tb" };
// const graphAttrs = ["acyclicer", "ranker", "rankdir", "align"];
// const nodeNumAttrs = ["width", "height"];
// const nodeDefaults = { width: 0, height: 0 };
// const edgeNumAttrs = ["minlen", "weight", "width", "height", "labeloffset"];
// const edgeDefaults = {
//   minlen: 1,
//   weight: 1,
//   width: 0,
//   height: 0,
//   labeloffset: 10,
//   labelpos: "r",
// };
// const edgeAttrs = ["labelpos"];

// export function updateInputGraph(inputGraph: Graph, layoutGraph: Graph) {
//   inputGraph.nodes().forEach((node) => {
//     const inputLabel = inputGraph.node(node);
//     const layoutLabel = layoutGraph.node(node);

//     if (inputLabel) {
//       inputLabel.x = layoutLabel.x;
//       inputLabel.y = layoutLabel.y;

//       if (layoutGraph.children(node).length) {
//         inputLabel.width = layoutLabel.width;
//         inputLabel.height = layoutLabel.height;
//       }
//     }
//   });

//   inputGraph.edges().forEach((edge) => {
//     const inputLabel = inputGraph.edge(edge);
//     const layoutLabel = layoutGraph.edge(edge);

//     inputLabel.points = layoutLabel.points;
//     if (!!layoutLabel?.x) {
//       inputLabel.x = layoutLabel.x;
//       inputLabel.y = layoutLabel.y;
//     }
//   });

//   const inputGraphLabel = inputGraph.graph() as any;
//   const layoutGraphLabel = layoutGraph.graph() as any;

//   inputGraphLabel.width = layoutGraphLabel.width;
//   inputGraphLabel.height = layoutGraphLabel.height;
// }

// export function buildLayoutGraph(inputGraph: Graph) {
//   const layoutGraph = new Graph({ multigraph: true, compound: true });
//   // const graph = canonicalize(inputGraph.graph());

//   layoutGraph.setGraph(
//     _.merge(
//       {},
//       graphDefaults,
//       selectNumberAttrs(graph, graphNumAttrs),
//       _.pick(graph, graphAttrs)
//     )
//   );

//   _.forEach(inputGraph.nodes(), function (v) {
//     const node = canonicalize(inputGraph.node(v));
//     layoutGraph.setNode(
//       v,
//       _.defaults(selectNumberAttrs(node, nodeNumAttrs), nodeDefaults)
//     );
//     layoutGraph.setParent(v, inputGraph.parent(v));
//   });

//   _.forEach(inputGraph.edges(), function (e) {
//     const edge = canonicalize(inputGraph.edge(e));
//     layoutGraph.setEdge(
//       e,
//       _.merge(
//         {},
//         edgeDefaults,
//         selectNumberAttrs(edge, edgeNumAttrs),
//         _.pick(edge, edgeAttrs)
//       )
//     );
//   });

//   return layoutGraph;
// }

export type NodeId = string;

export class RankTable {
  private nodeToRank: Map<NodeId, number>;
  private rankToNode: Map<number, NodeId[]>;
  size: number;

  constructor() {
    this.nodeToRank = new Map();
    this.rankToNode = new Map();
    this.size = this.rankToNode.size;
  }

  set(node: NodeId, rank: number) {
    const oldRank: NodeId[] = this.rankToNode.get(rank) || [];

    this.nodeToRank.set(node, rank);
    this.rankToNode.set(rank, [...oldRank, node]);
  }

  getByNode(node: NodeId) {
    return this.nodeToRank.get(node);
  }

  getByRank(rank: number) {
    return this.rankToNode.get(rank);
  }
}
