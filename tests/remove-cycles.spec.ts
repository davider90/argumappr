import "mocha";
import { assert } from "chai";

import { alg, Graph } from "graphlib";

import removeCycles, {
  getMaxNode,
  greedilyGetFS,
  handleEdges,
  deleteLoop,
  reverseEdge,
} from "../src/remove-cycles";

describe("Cycle Handling", () => {
  describe("Edge Reversal", () => {
    it("should be a function", () => {
      assert.isFunction(reverseEdge);
    });

    it("should return the original edge when reversing", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setEdge("a", "b");

      const edge = graph.edges()[0];
      let returnValue = reverseEdge(graph, ["a", "b"], [], edge);

      assert.isUndefined(returnValue);

      returnValue = reverseEdge(graph, ["a"], ["b"], edge);
      const expectedValue = { ...edge, value: undefined };

      assert.deepEqual(returnValue, expectedValue);
    });

    it("should reverse an edge from sources to sinks", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setEdge("a", "b");

      const edge = graph.edges()[0];

      reverseEdge(graph, ["a"], ["b"], edge);

      const expectedEdge = { v: "b", w: "a", value: undefined };
      const actualEdge = { ...graph.edges()[0], value: undefined };

      assert.deepEqual(actualEdge, expectedEdge);
    });
  });

  describe("Loop Deletion", () => {
    it("should be a function", () => {
      assert.isFunction(deleteLoop);
    });

    it("should return the loop when deleting", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setEdge("a", "b");

      let edge = graph.edges()[0];
      let returnValue = deleteLoop(graph, edge);

      assert.isUndefined(returnValue);

      graph.setEdge("a", "a");

      edge = graph.inEdges("a")![0];
      returnValue = deleteLoop(graph, edge);
      const expectedValue = { ...edge, value: undefined };

      assert.deepEqual(returnValue, expectedValue);
    });

    it("should delete a loop", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setEdge("a", "a");

      const edge = graph.edges()[0];

      deleteLoop(graph, edge);

      assert.isEmpty(graph.edges());
    });
  });

  describe("Edge Handling", () => {
    it("should be a function", () => {
      assert.isFunction(handleEdges);
    });

    it("should return an object of modified edges", () => {
      const graph = new Graph();
      const returnValue = handleEdges(graph, [], []);

      assert.isObject(returnValue);
      assert.property(returnValue, "deletedLoops");
      assert.property(returnValue, "reversedEdges");
      assert.isArray(returnValue.deletedLoops);
      assert.isArray(returnValue.reversedEdges);
    });

    it("should return the original edges that were modified", () => {
      const graph = new Graph();
      let returnValue = handleEdges(graph, [], []);

      assert.isEmpty(returnValue.deletedLoops);
      assert.isEmpty(returnValue.reversedEdges);

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      returnValue = handleEdges(graph, [], []);

      assert.isEmpty(returnValue.deletedLoops);
      assert.isEmpty(returnValue.reversedEdges);

      graph.setEdge("a", "a");

      returnValue = handleEdges(graph, ["a"], ["b", "c"]);
      const expectedEdge = { v: "a", w: "b", value: undefined };
      const expectedLoop = { v: "a", w: "a", value: undefined };

      assert.lengthOf(returnValue.reversedEdges, 1);
      assert.sameDeepMembers(returnValue.reversedEdges, [expectedEdge]);
      assert.lengthOf(returnValue.deletedLoops, 1);
      assert.sameDeepMembers(returnValue.deletedLoops, [expectedLoop]);
    });

    it("should reverse appropriate edges and delete loops", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("a", "a");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      handleEdges(graph, ["a", "b"], ["c"]);

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
      assert.sameMembers(returnValue.sinks, ["a", "b", "c"]);

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
      assert.sameMembers(returnValue.sources, ["b", "a"]);
      assert.sameMembers(returnValue.sinks, ["c", "d"]);
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

    it("should return an object of modified edges", () => {
      const graph = new Graph();
      const returnValue = removeCycles(graph);

      assert.isObject(returnValue);
    });

    it("should return the original edges that were modified", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      const edges = graph
        .edges()
        .map((edge) => ({ ...edge, value: undefined }));
      const returnValue = removeCycles(graph);

      assert.isNotEmpty(returnValue.reversedEdges);
      assert.includeDeepMembers(edges, returnValue.reversedEdges);
      assert.isEmpty(returnValue.deletedLoops);
    });

    it("should leave the graph acyclic", () => {
      const graph = new Graph();

      graph.setNode("a");
      graph.setNode("b");
      graph.setNode("c");
      graph.setEdge("a", "a");
      graph.setEdge("a", "b");
      graph.setEdge("b", "c");
      graph.setEdge("c", "a");

      removeCycles(graph);

      assert.isTrue(alg.isAcyclic(graph));
    });
  });
});
