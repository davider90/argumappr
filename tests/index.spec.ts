import "mocha";
import { assert } from "chai";

import npmPackage from "../src/index";

const { Graph, drawLayeredGraph } = npmPackage;

describe("Project", () => {
  describe("NPM Package", () => {
    it("should be an object", () => {
      assert.isObject(npmPackage);
    });

    it("should have a graph property", () => {
      assert.property(npmPackage, "Graph");
    });

    it("should have a drawLayeredGraph property", () => {
      assert.property(npmPackage, "drawLayeredGraph");
    });
  });

  describe("Layered Graph Drawing", () => {
    it("should be a function", () => {
      assert.isFunction(drawLayeredGraph);
    });

    const graph = new Graph();
    graph.setDefaultNodeLabel(() => ({}));
    graph.setDefaultEdgeLabel(() => ({}));

    graph.setNode("a");
    graph.setNode("b");
    graph.setNode("c");
    graph.setNode("d");
    graph.setNode("e");
    graph.setEdge("a", "b");
    graph.setEdge("b", "c");
    graph.setEdge("c", "e");
    graph.setEdge("e", "d");

    it("should return void", () => {
      assert.isUndefined(drawLayeredGraph(graph));
    });
  });
});
