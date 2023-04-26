import "mocha";
import { assert } from "chai";

import drawLayeredGraph from "../src/draw-layered-graph";
import Graph from "../src/graph";

describe("Layered Graph Drawing", () => {
  it("should be a function", () => {
    assert.isFunction(drawLayeredGraph);
  });

  it("test", () => {
    const g = new Graph();
    g.setNodes(["a", "b"]);
    drawLayeredGraph(g);
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

  it("test2", () => {
    const g = new Graph();
    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

    g.setNode("a");
    g.setNode("b");
    g.setNode("c");
    g.setNode("d");
    g.setNode("e");

    g.setEdge("a", "b");
    g.setEdge("b", "c");
    g.setEdge("b", "d");
    g.setEdge("e", "d");

    drawLayeredGraph(g);
  });
});
