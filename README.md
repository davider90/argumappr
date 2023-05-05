# Argumappr: Graph Layout for Argument Maps

Argumappr is a TypeScript package for automatic graph layout generation. It provides a graph data structure and a function for laying out graphs. Though it may be used to lay out any standard discrete graph, Argumappr is developed with argument maps in mind.

## Why Argumappr?

Argument maps may have quirks that make it hard to represent them by conventional discrete graphs. Namely, logical conjunctions and warrants (per the terminology of Toulmin) pose issues. Typically, vertices contain statements, and edges show what they infer. Thus, simple arguments are easily represented by two vertices (a premise and a conclusion) and a single edge (directed from the premise vertex to the conclusion one). By this convention, common graphs may adequately map fairly complex argument chains. However, conjunct arguments tend to be represented by several premise vertices whose edges conjoin and end in a single conclusion vertex. Moreover, warrants are normally drawn as a premise vertice with an out edge that points to another edge.

Argumappr supports graph structures that may contain vertices, simple edges, conjoined edges and warrant edges. Its layout algorithm can generate layouts efficiently and effectively, resulting in aesthetic layered graph drawings. Argumappr is renderer-agnostic and lightweight. It simply assigns vertices _x_- and _y_-coordinates and gives edges three points on a Bézier curve between its source and target. You can then pass this layout information to your favourite renderer.
