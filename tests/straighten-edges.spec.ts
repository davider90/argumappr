import "mocha";
import { assert } from "chai";

import straightenEdges from "../src/straighten-edges.js";
import Graph from "../src/graph.js";
import { NodeId, buildLayoutGraph } from "../src/utils.js";

describe("Straighten Edges", () => {
  it("should be a function", () => {
    assert.isFunction(straightenEdges);
  });

  it("should not return anything", () => {
    const graph = new Graph();
    const layoutGraph = buildLayoutGraph(graph);
    const graphMatrix: NodeId[][] = [];

    const result = straightenEdges(layoutGraph, graphMatrix);

    assert.isUndefined(result);
  });

  it("should assign x properties to nodes", () => {
    const graph = new Graph();

    graph.setNode("a");
    graph.setNode("b");
    graph.setNode("c");
    graph.setEdge("a", "b");
    graph.setEdge("b", "c");

    const layoutGraph = buildLayoutGraph(graph);
    const graphMatrix: NodeId[][] = [["a"], ["b"], ["c"]];

    straightenEdges(layoutGraph, graphMatrix);

    assert.isTrue(
      layoutGraph.nodes().every((node) => !isNaN(layoutGraph.node(node).x))
    );
  });

  it("should assign non-conflicting x properties to nodes", () => {
    const graph = new Graph();

    graph.setGraph({});
    graph.setDefaultNodeLabel(() => ({}));

    graph.setNode("a");
    graph.setNode("b");
    graph.setNode("c");
    graph.setNode("d");
    graph.setNode("e");
    graph.setNode("f");
    graph.setNode("g");
    graph.setNode("h");
    graph.setEdge("a", "d");
    graph.setEdge("a", "e");
    graph.setEdge("b", "d");
    graph.setEdge("b", "e");
    graph.setEdge("c", "d");
    graph.setEdge("c", "e");
    graph.setEdge("d", "f");
    graph.setEdge("d", "g");
    graph.setEdge("e", "h");

    const graphMatrix: NodeId[][] = [
      ["a", "b", "c"],
      ["d", "e"],
      ["f", "g", "h"],
    ];

    straightenEdges(graph, graphMatrix);

    assert.isTrue(
      graphMatrix.every((row) =>
        row.every((node) => {
          const nodeX = graph.node(node).x;

          return row.every((otherNode) => {
            if (node === otherNode) return true;

            const otherNodeX = graph.node(otherNode).x;

            return nodeX !== otherNodeX;
          });
        })
      )
    );
  });
});
