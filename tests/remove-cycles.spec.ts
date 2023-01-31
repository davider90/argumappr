import "mocha";
import { assert } from "chai";

import { alg, Graph } from "graphlib";

import removeCycles, {
  getMaxNode,
  greedilyGetFS,
  reverseEdges,
} from "../src/remove-cycles";

describe("Cycle Handling", () => {
  describe("Edge Reversal", () => {
    it("should be a function", () => {
      assert.isFunction(reverseEdges);
    });

    it("should return an array of edges", () => {
      const graph = new Graph();
      const returnValue = reverseEdges(graph, graph.edges(), [], []);

      assert.isArray(returnValue);
    });

    it("should return the original edges that were reversed", () => {
      const graph = new Graph();
      let returnValue = reverseEdges(graph, graph.edges(), [], []);

      assert.isEmpty(returnValue);

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      returnValue = reverseEdges(graph, graph.edges(), [], []);

      assert.isEmpty(returnValue);

      returnValue = reverseEdges(graph, graph.edges(), ["a"], ["b", "c"]);
      const expectedEdge = { v: "a", w: "b" };

      assert.lengthOf(returnValue, 1);
      assert.sameDeepMembers(returnValue, [expectedEdge]);
    });

    it("should reverse edges from sources to sinks", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");

      const oldEdges = [
        { v: "a", w: "b" },
        { v: "b", w: "c" },
        { v: "c", w: "a" },
      ];

      reverseEdges(graph, oldEdges, ["a", "b"], ["c"]);

      const expectedEdges = [
        { v: "a", w: "b" },
        { v: "c", w: "b" },
        { v: "c", w: "a" },
      ];

      assert.sameDeepMembers(graph.edges(), expectedEdges);
    });
  });

  describe("Max Node Finding", () => {
    it("should be a function", () => {
      assert.isFunction(getMaxNode);
    });

    it("should return a string", () => {
      const graph = new Graph();
      const returnValue = getMaxNode(graph);

      assert.isString(returnValue);
    });

    it("should return the node with the highest degree", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setNode("e");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("d", "e");
      graph.setEdge("a", "d");

      const returnValue = getMaxNode(graph);

      assert.equal(returnValue, "a");
    });
  });

  describe("Greedy Feedback Set Generation", () => {
    it("should be a function", () => {
      assert.isFunction(greedilyGetFS);
    });

    it("should return an object with sources and sinks", () => {
      const graph = new Graph();
      const returnValue = greedilyGetFS(graph);

      assert.isObject(returnValue);
      assert.property(returnValue, "sources");
      assert.property(returnValue, "sinks");
      assert.isArray(returnValue.sources);
      assert.isArray(returnValue.sinks);
    });

    it("should return sources and sinks of the graph", () => {
      const graph = new Graph();
      let returnValue = greedilyGetFS(graph);

      assert.isEmpty(returnValue.sources);
      assert.isEmpty(returnValue.sinks);

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "c");
      graph.setEdge("b", "c");

      returnValue = greedilyGetFS(graph);

      assert.isEmpty(returnValue.sources);
      assert.lengthOf(returnValue.sinks, 3);
      assert.sameDeepMembers(returnValue.sinks, ["a", "b", "c"]);

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setNode("d");
      graph.setEdge("a", "d");
      graph.setEdge("d", "c");
      graph.setEdge("c", "a");
      graph.setEdge("b", "a");
      graph.setEdge("b", "d");

      returnValue = greedilyGetFS(graph);

      assert.lengthOf(returnValue.sources, 2);
      assert.lengthOf(returnValue.sinks, 2);
      assert.sameDeepMembers(returnValue.sources, ["b", "a"]);
      assert.sameDeepMembers(returnValue.sinks, ["c", "d"]);
    });

    it("should leave the graph empty", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      greedilyGetFS(graph);

      assert.isEmpty(graph.nodes());
      assert.isEmpty(graph.edges());
    });
  });

  describe("Cycle Removal", () => {
    it("should be a function", () => {
      assert.isFunction(removeCycles);
    });

    it("should return an array of edges", () => {
      const graph = new Graph();
      const returnValue = removeCycles(graph);

      assert.isArray(returnValue);
    });

    it("should return the original edges that were reversed", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      const edges = [...graph.edges()];
      const returnValue = removeCycles(graph);

      assert.isNotEmpty(returnValue);
      assert.includeDeepMembers(edges, returnValue);
    });

    it("should leave the graph acyclic", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      removeCycles(graph);

      assert.isTrue(alg.isAcyclic(graph));
    });
  });
});
