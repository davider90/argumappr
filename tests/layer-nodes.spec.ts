import "mocha";
import { assert } from "chai";

import Graph from "../src/graph";
import layerNodes from "../src/layer-nodes";
import { RankTable } from "../src/utils";

describe("Node Layer Assignment", () => {
  it("should be a function", () => {
    assert.isFunction(layerNodes);
  });

  it("should return a node layering", () => {
    const graph = new Graph();
    const ranks = layerNodes(graph);
    const emptyRankTable = new RankTable();

    assert.hasAllKeys(ranks, Object.keys(emptyRankTable));
  });

  it("should assign nodes to layers", () => {
    const graph = new Graph();

    graph.setDefaultNodeLabel(() => ({}));
    graph.setDefaultEdgeLabel(() => ({}));

    graph.setNode("a");
    graph.setNode("b");
    graph.setNode("c");
    graph.setEdge("a", "b");
    graph.setEdge("b", "c");

    const ranks = layerNodes(graph);

    assert.strictEqual(ranks.getRank("a"), 0);
    assert.strictEqual(ranks.getRank("b"), 1);
    assert.strictEqual(ranks.getRank("c"), 2);
  });

  it("test", () => {
    const g = new Graph();

    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

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

    console.profile("layerNodes");
    const ranks = layerNodes(g);
    console.profileEnd("layerNodes");
  });

  it("test2", () => {
    const g = new Graph();

    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

    g.setNode("a");
    g.setNode("b");
    g.setEdge("a", "b");

    g.setNode("c");
    g.setEdge("c", "a");

    g.setNode("d");
    g.setEdge("a", "d");

    g.setNode("e");
    g.setEdge("e", "d");

    const ranking = layerNodes(g);
    console.log(ranking);
  });
});
