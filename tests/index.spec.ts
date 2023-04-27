import "mocha";
import { assert } from "chai";

import { Graph, layOutGraph } from "../src/index";

describe("NPM Package", () => {
  it("should export a class and a function", () => {
    assert.isFunction(Graph);
    assert.isFunction(layOutGraph);
  });
});
