import { RoughRenderer } from './renderers/RoughRenderer.js';
import { TurtleState } from './TurtleState.js';
import { InstructionQueue } from './InstructionQueue.js';
import type {
  Instruction,
  WhiteboardOptions,
  WhiteboardEvents,
} from './types.js';

/**
 * Main facade: an agent streams drawing instructions and the library
 * progressively animates them on a canvas with hand-drawn aesthetics.
 */
export class AgentWhiteboard {
  private renderer: RoughRenderer;
  private turtle: TurtleState;
  private queue: InstructionQueue;
  private events: WhiteboardEvents;
  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    options: WhiteboardOptions & WhiteboardEvents = {},
  ) {
    this.canvas = canvas;
    this.events = {
      onInstructionStart: options.onInstructionStart,
      onInstructionComplete: options.onInstructionComplete,
      onQueueEmpty: options.onQueueEmpty,
    };

    this.renderer = new RoughRenderer(canvas, options);
    this.turtle = new TurtleState(canvas.width / 2, canvas.height / 2);

    this.queue = new InstructionQueue(
      (instr, idx) => this.executeInstruction(instr, idx),
      () => this.events.onQueueEmpty?.(),
    );
  }

  /** Queue one or more instructions for sequential animated execution. */
  addInstructions(instructions: Instruction[]): void {
    this.queue.enqueue(instructions);
  }

  /** Resize the canvas to new logical dimensions at the given device pixel ratio. */
  resize(logicalW: number, logicalH: number, dpr = 1): void {
    this.renderer.resize(logicalW, logicalH, dpr);
  }

  /** Logical width of the canvas (excludes DPR scaling). */
  get logicalWidth(): number {
    return this.canvas.width / this.renderer.getDpr();
  }

  /** Logical height of the canvas (excludes DPR scaling). */
  get logicalHeight(): number {
    return this.canvas.height / this.renderer.getDpr();
  }

  /** Clear the canvas (keeps turtle position). */
  clear(): void {
    this.renderer.clear();
  }

  /** Full reset: clear canvas, reset turtle, clear pending queue. */
  reset(): void {
    this.queue.reset();
    this.renderer.clear();
    this.turtle.reset(this.logicalWidth / 2, this.logicalHeight / 2);
  }

  /** Number of completed instructions. */
  get completedCount(): number {
    return this.queue.completed;
  }

  /** Number of pending instructions. */
  get pendingCount(): number {
    return this.queue.pending;
  }

  /** Whether the queue is currently processing. */
  get isAnimating(): boolean {
    return this.queue.isProcessing;
  }

  // ---- Instruction execution ----

  private async executeInstruction(instruction: Instruction, index: number): Promise<void> {
    this.events.onInstructionStart?.(instruction, index);

    switch (instruction.type) {
      case 'moveTo':
        this.turtle.moveTo(instruction.x, instruction.y);
        break;

      case 'lineTo': {
        const fromX = this.turtle.x;
        const fromY = this.turtle.y;
        if (this.turtle.penDown) {
          await this.renderer.animateLine(
            fromX, fromY, instruction.x, instruction.y,
            this.turtle.color, this.turtle.strokeWidth,
          );
        }
        this.turtle.moveTo(instruction.x, instruction.y);
        break;
      }

      case 'forward': {
        const fromX = this.turtle.x;
        const fromY = this.turtle.y;
        const dest = this.turtle.forward(instruction.distance);
        if (this.turtle.penDown) {
          await this.renderer.animateLine(
            fromX, fromY, dest.x, dest.y,
            this.turtle.color, this.turtle.strokeWidth,
          );
        }
        break;
      }

      case 'turnLeft':
        this.turtle.turnLeft(instruction.angle);
        break;

      case 'turnRight':
        this.turtle.turnRight(instruction.angle);
        break;

      case 'penUp':
        this.turtle.penDown = false;
        break;

      case 'penDown':
        this.turtle.penDown = true;
        break;

      case 'setColor':
        this.turtle.color = instruction.color;
        break;

      case 'setStrokeWidth':
        this.turtle.strokeWidth = instruction.width;
        break;

      case 'drawRect':
        await this.renderer.animateRect(
          instruction.x, instruction.y,
          instruction.width, instruction.height,
          this.turtle.color, this.turtle.strokeWidth,
          instruction.fill, instruction.fillStyle,
        );
        break;

      case 'drawCircle':
        await this.renderer.animateCircle(
          instruction.x, instruction.y, instruction.radius,
          this.turtle.color, this.turtle.strokeWidth,
          instruction.fill, instruction.fillStyle,
        );
        break;

      case 'drawEllipse':
        await this.renderer.animateEllipse(
          instruction.x, instruction.y,
          instruction.width, instruction.height,
          this.turtle.color, this.turtle.strokeWidth,
          instruction.fill, instruction.fillStyle,
        );
        break;

      case 'writeText':
        await this.renderer.animateText(
          instruction.text, instruction.x, instruction.y,
          {
            fontSize: instruction.fontSize,
            font: instruction.font,
            color: this.turtle.color,
          },
        );
        break;

      case 'label':
        await this.renderer.animateText(
          instruction.text,
          this.turtle.x + (instruction.offsetX ?? 10),
          this.turtle.y + (instruction.offsetY ?? -20),
          {
            fontSize: instruction.fontSize,
            color: this.turtle.color,
          },
        );
        break;

      case 'clear':
        this.renderer.clear();
        break;

      case 'wait':
        await new Promise<void>((resolve) => setTimeout(resolve, instruction.duration));
        break;
    }

    this.events.onInstructionComplete?.(instruction, index);
  }
}
