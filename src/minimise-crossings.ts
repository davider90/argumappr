import { Graph } from "graphlib";
import { NodeId, RankTable } from "./utils";

export default function minimiseCrossings(graph: Graph, ranks: RankTable) {
  const rankArray = readRankTable(graph, ranks);

  for (let i = 1; i < rankArray.length; i++) {
    const previousLayer = rankArray[i - 1];
    const currentLayer = rankArray[i];

    for (let j = 0; j < currentLayer.length; j++) {
      const node = currentLayer[j];
      const predecessors = graph.predecessors(node)!;
      let predecessorsPositionSum = 0;

      predecessors.forEach((predecessor) => {
        predecessorsPositionSum += previousLayer.indexOf(predecessor);
      });

      const averagePredecessorPosition =
        predecessorsPositionSum / predecessors.length;
      const newNodePosition = Math.round(
        (averagePredecessorPosition / previousLayer.length) *
          currentLayer.length
      );

      currentLayer.splice(j, 1);
      currentLayer.splice(newNodePosition, 0, node);
    }
  }
}

function readRankTable(graph: Graph, ranks: RankTable) {
  const rankArray: NodeId[][] = [];
  let rankNumber = 0;
  let layer = ranks.getRankNodes(rankNumber);

  while (!!layer) {
    rankArray[rankNumber] = [];

    layer.forEach((_, node) => {
      rankArray[rankNumber].push(node);
    });

    rankNumber++;
    layer = ranks.getRankNodes(rankNumber);
  }

  return rankArray;
}
