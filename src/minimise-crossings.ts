import { Graph } from "graphlib";
import { NodeId, RankTable } from "./utils";

export default function minimiseCrossings(graph: Graph, ranks: RankTable) {
  const rankArray = readRankTable(graph, ranks);

  for (let i = 1; i < rankArray.length; i++) {
    const previousLayer = rankArray[i - 1];
    const currentLayer = rankArray[i];

    currentLayer.forEach((node) => {
      const predecessors = graph.predecessors(node)!;
      let predecessorsPositionSum = 0;

      predecessors.forEach((predecessor) => {
        predecessorsPositionSum += previousLayer.indexOf(predecessor);
      });

      const averagePosition = predecessorsPositionSum / predecessors.length;
    });
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
