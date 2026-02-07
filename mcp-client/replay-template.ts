/**
 * Generates a self-contained HTML file that replays a whiteboard session.
 * The HTML embeds all data, CSS, and JavaScript needed to render and navigate slides.
 */

interface ReplaySlide {
  instructions: unknown[];
  caption: string;
  timestamp: number;
}

interface ReplayData {
  version: number;
  exportedAt: string;
  slides: ReplaySlide[];
}

export function generateReplayHTML(data: ReplayData): string {
  // Escape data for safe embedding in script tag
  const jsonData = JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whiteboard Replay - ${new Date(data.exportedAt).toLocaleString()}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      padding: 0.75rem 1rem 0;
    }

    #container {
      width: 100%;
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    header {
      background: transparent;
      color: #e0e0e0;
      padding: 0 0 0.5rem 0;
      text-align: center;
      flex-shrink: 0;
    }

    header h1 {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 4px;
      color: #90a4ae;
    }

    header p {
      font-size: 12px;
      color: #666;
    }

    #canvas-container {
      position: relative;
      height: 550px;
      min-height: 200px;
      max-height: 85vh;
      flex-shrink: 0;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
    }

    #caption {
      padding: 0.5rem 0;
      font-size: 14px;
      line-height: 1.5;
      color: #90a4ae;
      text-align: center;
      min-height: 40px;
      flex-shrink: 0;
    }

    #controls {
      padding: 0.5rem 0;
      background: transparent;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .nav-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    button {
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      font-weight: 500;
      border: 1px solid #546e7a;
      border-radius: 16px;
      background: transparent;
      color: #b0bec5;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }

    button:hover:not(:disabled) {
      background: #263238;
      border-color: #90a4ae;
      color: #e0e0e0;
    }

    button:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .nav-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 4px;
      font-weight: bold;
    }

    #slide-indicator {
      font-size: 0.7rem;
      color: #90a4ae;
      min-width: 50px;
      text-align: center;
    }

    .play-controls {
      display: flex;
      gap: 8px;
    }

    #speed-control {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    #speed-control label {
      font-size: 0.8rem;
      color: #90a4ae;
    }

    #speed-select {
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      border: 1px solid #37474f;
      font-size: 0.8rem;
      background: #16213e;
      color: #e0e0e0;
      cursor: pointer;
    }

    .metadata {
      padding: 0.5rem 0;
      background: transparent;
      font-size: 0.7rem;
      color: #546e7a;
      text-align: center;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      #controls {
        flex-direction: column;
        align-items: stretch;
      }

      .nav-controls, .play-controls {
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div id="container">
    <header>
      <h1>Whiteboard Replay</h1>
      <p>Exported ${new Date(data.exportedAt).toLocaleString()} • ${data.slides.length} slide${data.slides.length !== 1 ? 's' : ''}</p>
    </header>

    <div id="canvas-container">
      <canvas id="whiteboard" width="800" height="550"></canvas>
    </div>

    <div id="caption"></div>

    <div id="controls">
      <div class="nav-controls">
        <button class="nav-btn" id="prev-btn" disabled>&lt;</button>
        <div id="slide-indicator">1 / ${data.slides.length}</div>
        <button class="nav-btn" id="next-btn">&gt;</button>
      </div>

      <div class="play-controls">
        <button id="play-btn">▶ Play</button>
        <button id="reset-btn">⟲ Reset</button>
      </div>

      <div id="speed-control">
        <label for="speed-select">Speed:</label>
        <select id="speed-select">
          <option value="0.5">0.5x</option>
          <option value="1" selected>1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
    </div>
  </div>

  <script type="module">
    // Embedded session data
    const SESSION_DATA = ${jsonData};

    // Embedded AgentWhiteboard engine (simplified for replay)
    ${getWhiteboardEngineCode()}

    // Replay controller
    class ReplayController {
      constructor(canvas, slides) {
        this.canvas = canvas;
        this.slides = slides;
        this.currentSlide = 0;
        this.whiteboard = new AgentWhiteboard(canvas);
        this.isPlaying = false;
        this.playSpeed = 1;
        this.setupControls();
        this.renderSlide(0);
      }

      setupControls() {
        document.getElementById('prev-btn').addEventListener('click', () => this.prevSlide());
        document.getElementById('next-btn').addEventListener('click', () => this.nextSlide());
        document.getElementById('play-btn').addEventListener('click', () => this.togglePlay());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        document.getElementById('speed-select').addEventListener('change', (e) => {
          this.playSpeed = parseFloat(e.target.value);
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') this.prevSlide();
          if (e.key === 'ArrowRight') this.nextSlide();
          if (e.key === ' ') { e.preventDefault(); this.togglePlay(); }
          if (e.key === 'r' || e.key === 'R') this.reset();
        });
      }

      async renderSlide(index) {
        if (index < 0 || index >= this.slides.length) return;
        
        this.currentSlide = index;
        const slide = this.slides[index];

        // Clear and redraw
        this.whiteboard.clear();
        await this.whiteboard.drawInstructions(slide.instructions, this.playSpeed);

        // Update caption
        document.getElementById('caption').textContent = slide.caption || 'No caption';

        // Update controls
        this.updateControls();
      }

      updateControls() {
        document.getElementById('prev-btn').disabled = this.currentSlide === 0;
        document.getElementById('next-btn').disabled = this.currentSlide === this.slides.length - 1;
        document.getElementById('slide-indicator').textContent = 
          \`\${this.currentSlide + 1} / \${this.slides.length}\`;
      }

      prevSlide() {
        if (this.currentSlide > 0) {
          this.renderSlide(this.currentSlide - 1);
        }
      }

      nextSlide() {
        if (this.currentSlide < this.slides.length - 1) {
          this.renderSlide(this.currentSlide + 1);
        }
      }

      async togglePlay() {
        const playBtn = document.getElementById('play-btn');
        
        if (this.isPlaying) {
          this.isPlaying = false;
          playBtn.textContent = '▶ Play All';
        } else {
          this.isPlaying = true;
          playBtn.textContent = '⏸ Pause';
          
          for (let i = this.currentSlide; i < this.slides.length && this.isPlaying; i++) {
            await this.renderSlide(i);
            if (i < this.slides.length - 1 && this.isPlaying) {
              await new Promise(resolve => setTimeout(resolve, 1000 / this.playSpeed));
            }
          }
          
          this.isPlaying = false;
          playBtn.textContent = '▶ Play All';
        }
      }

      reset() {
        this.isPlaying = false;
        document.getElementById('play-btn').textContent = '▶ Play All';
        this.renderSlide(0);
      }
    }

    // Initialize replay
    const canvas = document.getElementById('whiteboard');
    new ReplayController(canvas, SESSION_DATA.slides);
  </script>
</body>
</html>`;
}

/**
 * Returns the embedded whiteboard rendering engine code.
 * This is a simplified version that can render instructions without external dependencies.
 */
function getWhiteboardEngineCode(): string {
  return `
    class AgentWhiteboard {
      constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.angle = 0;
        this.penDown = true;
        this.color = '#000000';
        this.strokeWidth = 2;
      }

      clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;
        this.angle = 0;
        this.penDown = true;
        this.color = '#000000';
        this.strokeWidth = 2;
      }

      async drawInstructions(instructions, speed = 1) {
        for (const instr of instructions) {
          await this.executeInstruction(instr, speed);
        }
      }

      async executeInstruction(instr, speed) {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms / speed));

        switch (instr.type) {
          case 'moveTo':
            this.x = instr.x;
            this.y = instr.y;
            break;

          case 'lineTo':
            if (this.penDown) {
              this.ctx.strokeStyle = this.color;
              this.ctx.lineWidth = this.strokeWidth;
              this.ctx.beginPath();
              this.ctx.moveTo(this.x, this.y);
              this.ctx.lineTo(instr.x, instr.y);
              this.ctx.stroke();
            }
            this.x = instr.x;
            this.y = instr.y;
            await delay(10);
            break;

          case 'forward':
            const rad = (this.angle * Math.PI) / 180;
            const newX = this.x + Math.cos(rad) * instr.distance;
            const newY = this.y + Math.sin(rad) * instr.distance;
            if (this.penDown) {
              this.ctx.strokeStyle = this.color;
              this.ctx.lineWidth = this.strokeWidth;
              this.ctx.beginPath();
              this.ctx.moveTo(this.x, this.y);
              this.ctx.lineTo(newX, newY);
              this.ctx.stroke();
            }
            this.x = newX;
            this.y = newY;
            await delay(10);
            break;

          case 'turnLeft':
            this.angle -= instr.degrees;
            break;

          case 'turnRight':
            this.angle += instr.degrees;
            break;

          case 'penUp':
            this.penDown = false;
            break;

          case 'penDown':
            this.penDown = true;
            break;

          case 'setColor':
            this.color = instr.color;
            break;

          case 'setStrokeWidth':
            this.strokeWidth = instr.width;
            break;

          case 'drawRect':
            this.ctx.fillStyle = instr.fill || this.color;
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.strokeWidth;
            if (instr.fill) {
              this.ctx.fillRect(instr.x, instr.y, instr.width, instr.height);
            } else {
              this.ctx.strokeRect(instr.x, instr.y, instr.width, instr.height);
            }
            await delay(50);
            break;

          case 'drawCircle':
            this.ctx.fillStyle = instr.fill || this.color;
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.strokeWidth;
            this.ctx.beginPath();
            this.ctx.arc(instr.x, instr.y, instr.radius, 0, 2 * Math.PI);
            if (instr.fill) {
              this.ctx.fill();
            } else {
              this.ctx.stroke();
            }
            await delay(50);
            break;

          case 'writeText':
            this.ctx.fillStyle = this.color;
            this.ctx.font = \`\${instr.fontSize || 16}px sans-serif\`;
            this.ctx.fillText(instr.text, instr.x, instr.y);
            await delay(30);
            break;

          case 'clear':
            this.clear();
            break;

          case 'wait':
            await delay(instr.ms || 100);
            break;
        }
      }
    }
  `;
}
