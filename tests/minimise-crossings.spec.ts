import "mocha";
import { assert } from "chai";

import { Graph } from "graphlib";

import minimiseCrossings, {
  countCrossings,
  countTotalCrossings,
} from "../src/minimise-crossings";
import { RankTable } from "../src/utils";
import layerNodes from "../src/layer-nodes";

describe("Minimise Crossings", () => {
  describe("Count Crossings", () => {
    it("should be a function", () => {
      assert.isFunction(countCrossings);
    });

    it("should return a number", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setEdge("a", "b");

      const northLayer = ["a"];
      const southLayer = ["b"];

      const returnValue = countCrossings(graph, northLayer, southLayer);

      assert.isNumber(returnValue);
    });

    it("should return 0 for no crossings", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setNode("e");
      graph.setNode("f");
      graph.setEdge("a", "d");
      graph.setEdge("b", "e");
      graph.setEdge("c", "f");

      const northLayer = ["a", "b", "c"];
      const southLayer = ["d", "e", "f"];

      const returnValue = countCrossings(graph, northLayer, southLayer);

      assert.equal(returnValue, 0);
    });

    it("should return 1 for 1 crossing", () => {
      let graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setEdge("a", "d");
      graph.setEdge("b", "c");

      let northLayer = ["a", "b"];
      let southLayer = ["c", "d"];

      let returnValue = countCrossings(graph, northLayer, southLayer);

      assert.equal(returnValue, 1);

      graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setNode("e");
      graph.setNode("f");
      graph.setEdge("a", "d");
      graph.setEdge("b", "f");
      graph.setEdge("c", "e");

      northLayer = ["a", "b", "c"];
      southLayer = ["d", "e", "f"];

      returnValue = countCrossings(graph, northLayer, southLayer);

      assert.equal(returnValue, 1);
    });

    it("should return 2 for 2 crossings", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setNode("e");
      graph.setNode("f");
      graph.setEdge("a", "e");
      graph.setEdge("b", "d");
      graph.setEdge("b", "f");
      graph.setEdge("c", "e");

      const northLayer = ["a", "b", "c"];
      const southLayer = ["d", "e", "f"];

      const returnValue = countCrossings(graph, northLayer, southLayer);

      assert.equal(returnValue, 2);
    });

    it("should correctly count many crossings", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setNode("e");
      graph.setNode("f");
      graph.setNode("g");
      graph.setNode("h");
      graph.setNode("i");
      graph.setNode("j");
      graph.setNode("k");
      graph.setEdge("a", "g");
      graph.setEdge("b", "h");
      graph.setEdge("b", "i");
      graph.setEdge("c", "g");
      graph.setEdge("c", "j");
      graph.setEdge("c", "k");
      graph.setEdge("d", "g");
      graph.setEdge("d", "i");
      graph.setEdge("e", "j");
      graph.setEdge("f", "i");
      graph.setEdge("f", "k");

      const northLayer = ["a", "b", "c", "d", "e", "f"];
      const southLayer = ["g", "h", "i", "j", "k"];

      const returnValue = countCrossings(graph, northLayer, southLayer);

      assert.equal(returnValue, 12);
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

      const graphMatrix = minimiseCrossings(graph, ranks);

      assert.isArray(graphMatrix);
      assert.lengthOf(graphMatrix, 2);
      assert.lengthOf(graphMatrix[0], 2);
      assert.lengthOf(graphMatrix[1], 2);
    });

    it("should eliminate crossings when possible - simple", () => {
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

      const graphMatrix = minimiseCrossings(graph, ranks);

      assert.equal(graphMatrix[0][0], "b");
      assert.equal(graphMatrix[0][1], "a");
      assert.equal(graphMatrix[1][0], "c");
      assert.equal(graphMatrix[1][1], "d");
    });

    it("should eliminate crossings when possible - complex", () => {
      const graph = new Graph();
      graph.setDefaultNodeLabel(() => ({}));

      graph.setNode("b");
      graph.setNode("f");
      graph.setNode("d");
      graph.setNode("g");
      graph.setNode("c");
      graph.setNode("e");
      graph.setNode("i");
      graph.setNode("a");
      graph.setNode("h");
      graph.setNode("m");
      graph.setNode("j");
      graph.setNode("k");
      graph.setNode("l");
      graph.setNode("q");
      graph.setNode("n");
      graph.setNode("r");
      graph.setNode("o");
      graph.setNode("p");
      graph.setEdge("a", "d");
      graph.setEdge("b", "f");
      graph.setEdge("c", "g");
      graph.setEdge("d", "j");
      graph.setEdge("d", "i");
      graph.setEdge("k", "r");
      graph.setEdge("g", "p");
      graph.setEdge("e", "k");
      graph.setEdge("f", "m");
      graph.setEdge("a", "c");
      graph.setEdge("b", "e");
      graph.setEdge("h", "q");
      graph.setEdge("e", "l");
      graph.setEdge("a", "b");
      graph.setEdge("c", "h");
      graph.setEdge("g", "o");
      graph.setEdge("f", "n");

      const ranks = layerNodes(graph);
      const graphMatrix = minimiseCrossings(graph, ranks);
      const numberOfCrossings = countTotalCrossings(graph, graphMatrix);

      assert.equal(numberOfCrossings, 0);
    });

    it("should minimise the number of crossings", () => {
      const graph = new Graph();
      graph.setDefaultNodeLabel(() => ({}));

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setNode("e");
      graph.setEdge("a", "d");
      graph.setEdge("a", "e");
      graph.setEdge("b", "d");
      graph.setEdge("c", "d");

      const ranks = layerNodes(graph);
      const graphMatrix = minimiseCrossings(graph, ranks);
      const numberOfCrossings = countTotalCrossings(graph, graphMatrix);

      assert.equal(numberOfCrossings, 0);
    });
  });
});
