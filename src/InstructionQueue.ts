import type { Instruction } from './types.js';

export type InstructionExecutor = (instruction: Instruction, index: number) => Promise<void>;

/**
 * FIFO queue that executes instructions sequentially.
 * New instructions can be added while earlier ones are still animating.
 */
export class InstructionQueue {
  private queue: Instruction[] = [];
  private processing = false;
  private executedCount = 0;
  private executor: InstructionExecutor;
  private onEmpty?: () => void;

  constructor(executor: InstructionExecutor, onEmpty?: () => void) {
    this.executor = executor;
    this.onEmpty = onEmpty;
  }

  /** Add one or more instructions to the queue. */
  enqueue(instructions: Instruction[]): void {
    this.queue.push(...instructions);
    if (!this.processing) {
      this.processNext();
    }
  }

  /** Clear all pending (not yet started) instructions. */
  clearPending(): void {
    this.queue.length = 0;
  }

  /** Reset the queue completely. */
  reset(): void {
    this.queue.length = 0;
    this.processing = false;
    this.executedCount = 0;
  }

  /** Number of instructions executed so far. */
  get completed(): number {
    return this.executedCount;
  }

  /** Number of instructions waiting. */
  get pending(): number {
    return this.queue.length;
  }

  get isProcessing(): boolean {
    return this.processing;
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      this.onEmpty?.();
      return;
    }

    this.processing = true;
    const instruction = this.queue.shift()!;
    const index = this.executedCount;
    this.executedCount++;

    await this.executor(instruction, index);
    // Continue to next (allow microtask boundary)
    this.processNext();
  }
}
