/**
 * @module argumappr
 *
 * Provides a graph data structure via the {@link Graph} class and a function to
 * produce layered graph layouts via {@link layOutGraph}. Is specifically
 * developed to support argument maps, but can be used for other purposes.
 */

import Graph from "./graph.js";
import layOutGraph from "./lay-out-graph.js";

export { Graph, layOutGraph };
