import "mocha";
import { assert } from "chai";
import straightenEdges from "../src/straighten-edges";
import { Graph } from "graphlib";
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
    const graphMatrix: NodeId[][] = [];

    straightenEdges(graph, graphMatrix);

    assert.isTrue(
      graph.nodes().every((node) => graph.node(node).x !== undefined)
    );
  });
});
