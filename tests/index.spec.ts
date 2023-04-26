import "mocha";
import { assert } from "chai";

import npmPackage from "../src/index";

const { Graph, drawLayeredGraph } = npmPackage;

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
