import "mocha";
import { assert } from "chai";

import { Graph } from "graphlib";

import minimiseCrossings, { readRankTable } from "../src/minimise-crossings";
import { RankTable } from "../src/utils";

describe("Minimise Crossings", () => {
  describe("Read Rank Table", () => {
    it("should be a function", () => {
      assert.isFunction(readRankTable);
    });

    it("should return an array of arrays of nodes", () => {
      const ranks = new RankTable();

      ranks.set("a", 0);
      ranks.set("b", 0);
      ranks.set("c", 1);
      ranks.set("d", 1);

      const rankArray = readRankTable(ranks);

      assert.isArray(rankArray);
      assert.lengthOf(rankArray, 2);
      assert.lengthOf(rankArray[0], 2);
      assert.lengthOf(rankArray[1], 2);
    });
  });

  describe("Minimise Crossings", () => {
    it("should be a function", () => {
      assert.isFunction(minimiseCrossings);
    });

    it("should return an array of arrays of nodes", () => {
      const graph = new Graph();
      const ranks = new RankTable();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setEdge("a", "c");
      graph.setEdge("b", "d");

      ranks.set("a", 0);
      ranks.set("b", 0);
      ranks.set("c", 1);
      ranks.set("d", 1);

      const rankArray = minimiseCrossings(graph, ranks);

      assert.isArray(rankArray);
      assert.lengthOf(rankArray, 2);
      assert.lengthOf(rankArray[0], 2);
      assert.lengthOf(rankArray[1], 2);
    });

    it("should return an array of correctly ordered layers", () => {
      const graph = new Graph();
      const ranks = new RankTable();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setEdge("a", "d");
      graph.setEdge("b", "c");

      ranks.set("a", 0);
      ranks.set("b", 0);
      ranks.set("c", 1);
      ranks.set("d", 1);

      const rankArray = minimiseCrossings(graph, ranks);

      assert.equal(rankArray[0][0], "a");
      assert.equal(rankArray[0][1], "b");
      assert.equal(rankArray[1][0], "d");
      assert.equal(rankArray[1][1], "c");
    });
  });
});
