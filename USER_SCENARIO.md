# Agent Whiteboard — User Scenarios

Testable scenarios for verifying the MCP whiteboard server (Node.js or Go).

## 1. Basic Draw

1. Open `http://localhost:$PORT` in a browser.
2. Call the `draw` tool with a caption and instructions for a square:
   ```json
   {
     "caption": "A simple square",
     "instructions": [
       { "type": "drawRect", "x": 200, "y": 150, "width": 200, "height": 200 }
     ]
   }
   ```
3. **Expect:** Canvas shows an animated square; caption reads "A simple square"; "Continue" button appears after animation completes.
4. Click **Continue**.
5. **Expect:** Tool call unblocks and returns success text with "Viewer acknowledged."

## 2. Auto-Clear

1. Call `draw` with a circle, click Continue.
2. Call `draw` again with a rectangle.
3. **Expect:** The circle is gone; only the rectangle is visible. Canvas was auto-cleared before the second draw.

## 3. Explicit Clear

1. Call `draw` with any shape, click Continue.
2. Call the `clear` tool.
3. **Expect:** Canvas is blank, caption is empty, controls are hidden. Tool returns "Whiteboard cleared."

## 4. All Instruction Types

Call `draw` with one instruction of each category:

```json
{
  "caption": "All instruction types",
  "instructions": [
    { "type": "moveTo", "x": 100, "y": 100 },
    { "type": "penDown" },
    { "type": "setColor", "color": "#ff0000" },
    { "type": "setStrokeWidth", "width": 3 },
    { "type": "lineTo", "x": 300, "y": 100 },
    { "type": "forward", "distance": 100 },
    { "type": "turnRight", "angle": 90 },
    { "type": "forward", "distance": 50 },
    { "type": "penUp" },
    { "type": "moveTo", "x": 400, "y": 200 },
    { "type": "drawRect", "x": 400, "y": 200, "width": 100, "height": 80 },
    { "type": "drawCircle", "x": 600, "y": 300, "radius": 50, "fill": "#00ff00" },
    { "type": "drawEllipse", "x": 200, "y": 400, "width": 120, "height": 60 },
    { "type": "writeText", "text": "Hello", "x": 450, "y": 100 },
    { "type": "label", "text": "here" },
    { "type": "wait", "duration": 200 }
  ]
}
```

**Expect:** All shapes, lines, and text render without errors. Continue button appears.

## 5. Instruction Resource

Read the `whiteboard://instructions` resource.

**Expect:** Returns markdown with a complete reference table of all 16 instruction types including Movement, Pen State, Shapes, Text, and Control sections.

## 6. WebSocket Reconnect

1. Open browser to the whiteboard.
2. Restart the server process.
3. **Expect:** Browser status changes to "Connecting..." then back to "Connected" automatically (exponential backoff reconnect).

## 7. Multiple Browsers

1. Open two browser tabs to `http://localhost:$PORT`.
2. Call `draw` with a shape.
3. **Expect:** Both tabs show the same drawing and caption. Clicking Continue in either tab acknowledges the draw.

## 8. Ack Timeout

1. Call `draw` with a shape.
2. Do **not** click Continue for 5 minutes.
3. **Expect:** Tool returns with "(viewer timed out)" suffix in the response text.
