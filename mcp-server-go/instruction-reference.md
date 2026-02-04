# Agent Whiteboard — Instruction Reference

All instructions are JSON objects with a `type` field plus type-specific parameters.

## Movement
| type | params | description |
|------|--------|-------------|
| moveTo | x, y | Move turtle to absolute position (no drawing) |
| lineTo | x, y | Draw a line from current position to (x, y) |
| forward | distance | Move forward in the current heading direction |
| turnLeft | angle | Rotate heading counter-clockwise (degrees) |
| turnRight | angle | Rotate heading clockwise (degrees) |

## Pen State
| type | params | description |
|------|--------|-------------|
| penUp | *(none)* | Lift pen — movement won't draw |
| penDown | *(none)* | Lower pen — movement will draw |
| setColor | color | Set stroke color (CSS color string, e.g. "#ff0000") |
| setStrokeWidth | width | Set stroke width in pixels |

## Shapes
| type | params | description |
|------|--------|-------------|
| drawRect | x, y, width, height, fill?, fillStyle? | Draw rectangle (fill is optional CSS color) |
| drawCircle | x, y, radius, fill?, fillStyle? | Draw circle |
| drawEllipse | x, y, width, height, fill?, fillStyle? | Draw ellipse |

**fillStyle** (optional, default "solid"): "solid", "hachure", "zigzag", "cross-hatch", "dots", "dashed", "zigzag-line"

## Text
| type | params | description |
|------|--------|-------------|
| writeText | text, x, y, fontSize?, font? | Draw text at absolute position |
| label | text, offsetX?, offsetY?, fontSize? | Draw text near current turtle position |

## Control
| type | params | description |
|------|--------|-------------|
| clear | *(none)* | Clear the canvas |
| wait | duration | Pause animation for duration milliseconds |

## Canvas
Default canvas size is **{{W}} × {{H}}** pixels. Origin (0,0) is top-left.
Turtle starts at center ({{CX}}, {{CY}}) heading up (0°).
