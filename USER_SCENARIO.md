# Agent Whiteboard — User Scenarios

Testable scenarios for verifying the MCP whiteboard server.

> **Note:** The `draw` tool **blocks** until the viewer responds in the browser (click Continue, type a message, or timeout after 5 minutes). When testing programmatically, you must click Continue in the browser **while the draw call is pending** — otherwise the call hangs indefinitely.
>
> **Programmatic testing technique:** Since the stdio MCP `draw` call blocks the caller, use the **HTTP MCP endpoint** instead. Send draw requests via `curl` to `POST http://localhost:$PORT/mcp` in the background, then interact with the browser (click Continue, type a response) while the request is pending, then read the curl output to verify the result. Example:
>
> ```bash
> # Send draw in background (blocks until viewer responds)
> curl -s --max-time 30 -X POST http://localhost:3001/mcp \
>   -H 'Content-Type: application/json' \
>   -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"draw","arguments":{"caption":"Test","instructions":[{"type":"drawRect","x":200,"y":150,"width":200,"height":200}]}}}' \
>   > /tmp/draw-result.txt &
>
> # Click Continue in browser while curl is pending...
>
> # Then read the result
> cat /tmp/draw-result.txt
> # => event: message
> # => data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Viewer responded: Continue ..."}]}}
> ```

## 1. npx Launch

1. Run `npx agent-whiteboard`.
2. **Expect:** Server starts, prints `Agent Whiteboard UI: http://localhost:<port>` and `MCP endpoint: POST http://localhost:<port>/mcp` to stderr, and opens the browser automatically.

## 2. Basic Draw

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
3. **Expect (in browser, while draw call is pending):** Canvas shows an animated square; caption reads "A simple square"; "Continue" button appears after animation completes.
4. Click **Continue** in the browser.
5. **Expect:** Tool call unblocks and returns "Viewer acknowledged."

## 3. Viewer Free-Form Response

1. Call `draw` with any shape.
2. **While the draw call is pending**, type "I don't understand" in the chat input and submit.
3. **Expect:** Tool call unblocks and returns "Viewer responded: I don't understand".

## 4. Auto-Clear

1. Call `draw` with a circle; click Continue in the browser while pending.
2. Call `draw` again with a rectangle.
3. **Expect (in browser):** The circle is gone; only the rectangle is visible. Canvas was auto-cleared before the second draw.
4. Click Continue to unblock.

## 5. Explicit Clear

1. Call `draw` with any shape; click Continue in the browser while pending.
2. Call the `clear` tool.
3. **Expect:** Canvas is blank, caption is empty, controls are hidden. Tool returns "Whiteboard cleared."

## 6. Slide Progress

1. Call `draw` with `slide: 1` and `totalSlides: 3`:
   ```json
   {
     "caption": "Step one",
     "instructions": [
       { "type": "drawCircle", "x": 450, "y": 300, "radius": 50 }
     ],
     "slide": 1,
     "totalSlides": 3
   }
   ```
2. **Expect (in browser, while pending):** The viewer UI shows progress (e.g. "1 / 3").
3. Click Continue, then send slides 2 and 3 (clicking Continue between each).
4. **Expect:** Progress updates on each draw call.

## 7. All Instruction Types

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

**Expect (in browser, while pending):** All shapes, lines, and text render without errors. Continue button appears. Click Continue to unblock.

## 8. Fill Styles

1. Call `draw` with shapes using `fillStyle`:
   ```json
   {
     "caption": "Fill styles",
     "instructions": [
       { "type": "drawRect", "x": 50, "y": 100, "width": 120, "height": 80, "fill": "#2196F3", "fillStyle": "hachure" },
       { "type": "drawCircle", "x": 350, "y": 140, "radius": 50, "fill": "#4CAF50", "fillStyle": "cross-hatch" },
       { "type": "drawEllipse", "x": 550, "y": 100, "width": 140, "height": 80, "fill": "#FF9800", "fillStyle": "dots" }
     ]
   }
   ```
2. **Expect (in browser, while pending):** Each shape renders with the specified fill pattern (hachure, cross-hatch, dots) rather than a solid fill. Click Continue to unblock.

## 9. Instruction Resource

Read the `whiteboard://instructions` resource.

**Expect:** Returns markdown with a complete reference table of all 16 instruction types including Movement, Pen State, Shapes, Text, and Control sections. Canvas dimensions reflect the current viewport size.

## 10. Diagramming Guide Resource

Read the `whiteboard://diagramming-guide` resource.

**Expect:** Returns markdown covering cognitive principles (gradual reveal, one concept per slide, spatial consistency), diagram type selection, layout rules, arrow drawing patterns, and color palette. Canvas dimensions reflect the current viewport size.

## 11. HTTP-Only Mode (`--no-stdio-mcp`)

1. Run `PORT=3005 npx agent-whiteboard --no-stdio-mcp`.
2. **Expect:** Server prints "Running in HTTP-only mode" to stderr. No stdio MCP transport is started.
3. Send an MCP request via HTTP: `POST http://localhost:3005/mcp`.
4. **Expect:** MCP endpoint responds normally (tools are available).
5. Press Ctrl+C.
6. **Expect:** Server shuts down cleanly.

## 12. Remote WebSocket Mode (`--ws`)

1. Start a whiteboard server: `PORT=3005 npx agent-whiteboard --no-stdio-mcp`.
2. Open `http://localhost:3005` in a browser.
3. In a second terminal, run: `npx agent-whiteboard --ws ws://localhost:3005/ws`.
4. Call `draw` via stdio MCP on the second process.
5. **Expect:** The drawing appears in the browser connected to the first server. Clicking Continue in the browser unblocks the draw call on the second process.

## 13. Dynamic Viewport

1. Open the whiteboard in a browser.
2. Resize the browser window.
3. Read the `whiteboard://instructions` resource.
4. **Expect:** The canvas dimensions in the response reflect the browser's reported viewport size, not the default 900x600.

## 14. WebSocket Reconnect

1. Open browser to the whiteboard.
2. Restart the server process.
3. **Expect:** Browser status changes to "Connecting..." then back to "Connected" automatically (exponential backoff reconnect).

## 15. Multiple Browsers

1. Open two browser tabs to `http://localhost:$PORT`.
2. Call `draw` with a shape.
3. **Expect (while pending):** Both tabs show the same drawing and caption. Clicking Continue in either tab unblocks the draw call.

## 16. Ack Timeout

1. Call `draw` with a shape.
2. Do **not** click Continue for 5 minutes.
3. **Expect:** Tool returns with "Viewer timed out."
