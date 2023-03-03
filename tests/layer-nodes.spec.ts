import "mocha";
import { assert } from "chai";

import { Edge, Graph } from "graphlib";

import layerNodes, { setRanks, getTightTree } from "../src/layer-nodes";
import { RankTable } from "../src/utils";

describe("Node Layer Assignment", () => {
  it("test", () => {
    const g = new Graph();

    g.setNode("b");
    g.setNode("c");
    g.setNode("d");
    g.setNode("e");
    g.setNode("f");
    g.setNode("g");
    g.setNode("h");
    g.setNode("i");
    g.setNode("a");
    g.setNode("j");
    g.setNode("k");
    g.setNode("l");
    g.setNode("m");
    g.setNode("n");
    g.setNode("o");
    g.setNode("p");
    g.setNode("q");
    g.setNode("r");
    g.setEdge("a", "c");
    g.setEdge("a", "d");
    g.setEdge("b", "e");
    g.setEdge("b", "f");
    g.setEdge("c", "g");
    g.setEdge("c", "h");
    g.setEdge("d", "i");
    g.setEdge("d", "j");
    g.setEdge("e", "k");
    g.setEdge("a", "b");
    g.setEdge("e", "l");
    g.setEdge("f", "m");
    g.setEdge("f", "n");
    g.setEdge("g", "o");
    g.setEdge("g", "p");
    g.setEdge("h", "q");
    g.setEdge("k", "r");

    g.setEdge("i", "c");
    g.setEdge("l", "g");

    const ranks = layerNodes(g);
    console.log(ranks);
  });
  // describe("Initial Ranking", () => {
  //   it("should be a function", () => {
  //     assert.isFunction(setRanks);
  //   });

  //   it("should return a mapping of nodes to ranks", () => {
  //     const graph = new Graph();
  //     let returnValue = setRanks(graph);

  //     assert.instanceOf(returnValue, Map);
  //     assert.isEmpty(returnValue);

  //     graph.setNode("a");
  //     graph.setNode("b");
  //     graph.setNode("c");
  //     graph.setNode("d");
  //     graph.setEdge("a", "b");
  //     graph.setEdge("b", "c");
  //     graph.setEdge("b", "d");

  //     returnValue = setRanks(graph);
  //     const returnedNodes = [...returnValue.keys()];
  //     const expectedNodes = ["a", "b", "c", "d"];
  //     const returnedRanks = [...returnValue.values()];
  //     const expectedRanks = [0, 1, 2, 2];

  //     assert.lengthOf(returnedNodes, 4);
  //     assert.sameMembers(returnedNodes, expectedNodes);
  //     assert.lengthOf(returnedRanks, 4);
  //     assert.sameMembers(returnedRanks, expectedRanks);
  //   });
  // });

  // describe("Tight Tree Generation", () => {
  //   it("should be a function", () => {
  //     assert.isFunction(getTightTree);
  //   });

  //   it("should return a tight tree", () => {
  //     const graph = new Graph();
  //     let ranks = new Map();
  //     let returnValue = getTightTree(graph, ranks);

  //     assert.isObject(returnValue);
  //     assert.strictEqual(returnValue.nodeCount(), 0);

  //     graph.setNode("a");
  //     graph.setNode("b");
  //     graph.setNode("c");
  //     graph.setNode("d");
  //     graph.setEdge("a", "b");
  //     graph.setEdge("b", "c");
  //     graph.setEdge("c", "d");

  //     ranks = setRanks(graph);
  //     returnValue = getTightTree(graph, ranks);

  //     assert.strictEqual(returnValue.nodeCount(), 4);
  //   });
  // });

  // describe("Node Layering", () => {
  //   it("should be a function", () => {
  //     assert.isFunction(layerNodes);
  //   });

  //   it("should return an array of layers", () => {
  //     const graph = new Graph();
  //     let returnValue = layerNodes(graph);

  //     assert.isArray(returnValue);
  //     assert.lengthOf(returnValue, 1);
  //     assert.isArray(returnValue[0]);
  //     assert.isEmpty(returnValue[0]);

  //     graph.setNode("a");
  //     graph.setNode("b");
  //     graph.setNode("c");
  //     graph.setEdge("a", "b");
  //     graph.setEdge("b", "c");
  //     graph.setEdge("c", "a");

  //     returnValue = layerNodes(graph);
  //     const returnedNodes = returnValue.flat();
  //     const expectedNodes = ["a", "b", "c"];

  //     assert.lengthOf(returnValue, 2);
  //     assert.isNotEmpty(returnValue[0]);
  //     assert.isNotEmpty(returnValue[1]);
  //     assert.sameMembers(returnedNodes, expectedNodes);
  //   });
  // });
});
