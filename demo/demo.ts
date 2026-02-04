import { AgentWhiteboard } from '../src/index.js';
import type { Instruction } from '../src/index.js';

const canvas = document.getElementById('whiteboard') as HTMLCanvasElement;
const status = document.getElementById('status')!;

const board = new AgentWhiteboard(canvas, {
  animationSpeed: 1.5,
  roughness: 1.2,
  strokeWidth: 2,
  onInstructionStart: (instr, idx) => {
    status.textContent = `Executing: ${instr.type} (#${idx + 1})`;
  },
  onInstructionComplete: (_instr, idx) => {
    status.textContent = `Completed #${idx + 1}`;
  },
  onQueueEmpty: () => {
    status.textContent = 'Done — ready for more instructions';
  },
});

// ---- Architecture Diagram ----
const architectureInstructions: Instruction[] = [
  // Title
  { type: 'writeText', text: 'System Architecture', x: 300, y: 20, fontSize: 24 },
  { type: 'wait', duration: 300 },

  // Agent box
  { type: 'setColor', color: '#2266aa' },
  { type: 'drawRect', x: 50, y: 80, width: 180, height: 90, fill: '#d0e4f7' },
  { type: 'writeText', text: 'AI Agent', x: 95, y: 112, fontSize: 18 },
  { type: 'wait', duration: 200 },

  // Arrow: Agent -> Queue
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 230, y: 125 },
  { type: 'lineTo', x: 330, y: 125 },

  // Queue box
  { type: 'setColor', color: '#aa6622' },
  { type: 'drawRect', x: 330, y: 80, width: 200, height: 90, fill: '#fde8c8' },
  { type: 'writeText', text: 'Instruction Queue', x: 350, y: 112, fontSize: 16 },
  { type: 'wait', duration: 200 },

  // Arrow: Queue -> Renderer
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 530, y: 125 },
  { type: 'lineTo', x: 630, y: 125 },

  // Renderer box
  { type: 'setColor', color: '#22aa66' },
  { type: 'drawRect', x: 630, y: 80, width: 220, height: 90, fill: '#c8f5dc' },
  { type: 'writeText', text: 'Rough Renderer', x: 670, y: 105, fontSize: 16 },
  { type: 'writeText', text: '(Two-Canvas)', x: 685, y: 128, fontSize: 13 },
  { type: 'wait', duration: 200 },

  // Arrow: Renderer -> Canvas
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 740, y: 170 },
  { type: 'lineTo', x: 740, y: 230 },

  // Canvas box
  { type: 'setColor', color: '#8833aa' },
  { type: 'drawRect', x: 620, y: 230, width: 240, height: 80, fill: '#e8d0f8' },
  { type: 'writeText', text: 'HTML Canvas', x: 685, y: 260, fontSize: 16 },

  // Turtle state box
  { type: 'setColor', color: '#aa3344' },
  { type: 'drawRect', x: 330, y: 230, width: 200, height: 80, fill: '#f8d0d4' },
  { type: 'writeText', text: 'Turtle State', x: 375, y: 260, fontSize: 16 },

  // Arrow: Queue -> Turtle
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 430, y: 170 },
  { type: 'lineTo', x: 430, y: 230 },

  // Caption
  { type: 'setColor', color: '#666' },
  { type: 'writeText', text: 'Instructions flow left to right, each animated sequentially', x: 200, y: 360, fontSize: 14 },
];

// ---- Flowchart ----
const flowchartInstructions: Instruction[] = [
  { type: 'setColor', color: '#333' },
  { type: 'writeText', text: 'Decision Flowchart', x: 340, y: 20, fontSize: 22 },
  { type: 'wait', duration: 200 },

  // Start circle
  { type: 'setColor', color: '#2a7' },
  { type: 'drawCircle', x: 450, y: 90, radius: 35, fill: '#c8f5dc' },
  { type: 'writeText', text: 'Start', x: 425, y: 80, fontSize: 14 },

  // Arrow down
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 450, y: 125 },
  { type: 'lineTo', x: 450, y: 170 },

  // Decision diamond (drawn as a rect rotated — simplified as rect here)
  { type: 'setColor', color: '#aa6622' },
  { type: 'drawRect', x: 350, y: 170, width: 200, height: 80, fill: '#fde8c8' },
  { type: 'writeText', text: 'Is data valid?', x: 400, y: 200, fontSize: 15 },

  // Yes branch (right)
  { type: 'setColor', color: '#2a7' },
  { type: 'moveTo', x: 550, y: 210 },
  { type: 'lineTo', x: 680, y: 210 },
  { type: 'writeText', text: 'Yes', x: 600, y: 190, fontSize: 13 },

  // Process box (right)
  { type: 'setColor', color: '#2266aa' },
  { type: 'drawRect', x: 680, y: 180, width: 160, height: 60, fill: '#d0e4f7' },
  { type: 'writeText', text: 'Process Data', x: 710, y: 200, fontSize: 15 },

  // No branch (down)
  { type: 'setColor', color: '#c44' },
  { type: 'moveTo', x: 450, y: 250 },
  { type: 'lineTo', x: 450, y: 320 },
  { type: 'writeText', text: 'No', x: 458, y: 275, fontSize: 13 },

  // Error box
  { type: 'setColor', color: '#aa3344' },
  { type: 'drawRect', x: 350, y: 320, width: 200, height: 60, fill: '#f8d0d4' },
  { type: 'writeText', text: 'Show Error', x: 405, y: 340, fontSize: 15 },

  // Arrow from error back up (loop)
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 350, y: 350 },
  { type: 'lineTo', x: 280, y: 350 },
  { type: 'lineTo', x: 280, y: 210 },
  { type: 'lineTo', x: 350, y: 210 },
  { type: 'writeText', text: 'Retry', x: 250, y: 270, fontSize: 12 },

  // Arrow from Process to End
  { type: 'setColor', color: '#444' },
  { type: 'moveTo', x: 760, y: 240 },
  { type: 'lineTo', x: 760, y: 320 },

  // End circle
  { type: 'setColor', color: '#8833aa' },
  { type: 'drawCircle', x: 760, y: 360, radius: 30, fill: '#e8d0f8' },
  { type: 'writeText', text: 'End', x: 741, y: 352, fontSize: 14 },
];

// ---- Turtle Spiral ----
function generateSpiral(): Instruction[] {
  const instructions: Instruction[] = [
    { type: 'setColor', color: '#2266aa' },
    { type: 'setStrokeWidth', width: 2 },
    { type: 'moveTo', x: 450, y: 300 },
    { type: 'penDown' },
  ];

  const colors = ['#2266aa', '#aa3344', '#22aa66', '#aa6622', '#8833aa'];
  for (let i = 0; i < 60; i++) {
    if (i % 12 === 0) {
      instructions.push({ type: 'setColor', color: colors[(i / 12) % colors.length] });
    }
    instructions.push({ type: 'forward', distance: 3 + i * 2 });
    instructions.push({ type: 'turnRight', angle: 91 });
  }

  instructions.push(
    { type: 'penUp' },
    { type: 'setColor', color: '#333' },
    { type: 'writeText', text: 'Turtle Spiral', x: 380, y: 540, fontSize: 18 },
  );

  return instructions;
}

// ---- Button handlers ----
document.getElementById('btn-architecture')!.addEventListener('click', () => {
  board.reset();
  board.addInstructions(architectureInstructions);
});

document.getElementById('btn-flowchart')!.addEventListener('click', () => {
  board.reset();
  board.addInstructions(flowchartInstructions);
});

document.getElementById('btn-spiral')!.addEventListener('click', () => {
  board.reset();
  board.addInstructions(generateSpiral());
});

document.getElementById('btn-clear')!.addEventListener('click', () => {
  board.reset();
});

document.getElementById('btn-run-json')!.addEventListener('click', () => {
  const textarea = document.getElementById('json-input') as HTMLTextAreaElement;
  try {
    const instructions = JSON.parse(textarea.value) as Instruction[];
    if (!Array.isArray(instructions)) {
      throw new Error('Input must be a JSON array');
    }
    board.addInstructions(instructions);
    status.textContent = `Queued ${instructions.length} instructions`;
  } catch (e: any) {
    status.textContent = `Error: ${e.message}`;
  }
});
