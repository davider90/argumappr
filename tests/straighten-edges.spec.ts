import "mocha";
import { assert } from "chai";

import straightenEdges from "../src/straighten-edges";
import Graph from "../src/graph";
import { NodeId } from "../src/utils";

describe("Straighten Edges", () => {
  it("should be a function", () => {
    assert.isFunction(straightenEdges);
  });

  it("should not return anything", () => {
    const graph = new Graph();
    const graphMatrix: NodeId[][] = [];

    const result = straightenEdges(graph, graphMatrix);

    assert.isUndefined(result);
  });

  it("should assign x properties to nodes", () => {
    const graph = new Graph();

    graph.setDefaultNodeLabel(() => ({}));
    graph.setNode("a");
    graph.setNode("b");
    graph.setNode("c");
    graph.setEdge("a", "b");
    graph.setEdge("b", "c");

    const graphMatrix: NodeId[][] = [["a"], ["b"], ["c"]];

    straightenEdges(graph, graphMatrix);

    assert.isTrue(
      graph.nodes().every((node) => graph.node(node).x !== undefined)
    );
  });

  it("should assign non-conflicting x properties to nodes", () => {
    const graph = new Graph();

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
