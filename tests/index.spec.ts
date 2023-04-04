import "mocha";
import { assert } from "chai";

import project from "../src/index";
import npmPackage from "../src/index";

const { graphlib, drawLayeredGraph } = project;

describe("Project", () => {
  describe("NPM Package", () => {
    it("should be an object", () => {
      assert.isObject(npmPackage);
    });

    it("should have a graphLib property", () => {
      assert.property(npmPackage, "graphlib");
    });

    it("should have a drawLayeredGraph property", () => {
      assert.property(npmPackage, "drawLayeredGraph");
    });
  });

  describe("Graphlib", () => {
    it("should be an object", () => {
      assert.isObject(graphlib);
    });

    it("should have a Graph property", () => {
      assert.property(graphlib, "Graph");
    });

    it("Graph should be a class (function)", () => {
      assert.isFunction(graphlib.Graph);
    });
  });

  describe("Layered Graph Drawing", () => {
    it("should be a function", () => {
      assert.isFunction(drawLayeredGraph);
    });

    const graph = new graphlib.Graph();
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
