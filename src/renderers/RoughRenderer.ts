import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas.js';
import type { Drawable } from 'roughjs/bin/core.js';
import { ProgressiveAnimator } from './ProgressiveAnimator.js';
import { TextRenderer } from './TextRenderer.js';
import { measureOps } from '../utils/math.js';
import { easeOutCubic } from '../utils/easing.js';
import type { WhiteboardOptions } from '../types.js';

/**
 * Two-canvas rendering architecture:
 * - Persist canvas (offscreen): accumulates completed drawings
 * - Display canvas (visible): each frame = persist snapshot + in-progress animation
 *
 * When an animation completes, the final result is committed to the persist canvas.
 */
export class RoughRenderer {
  private displayCanvas: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;
  private persistCanvas: OffscreenCanvas | HTMLCanvasElement;
  private persistCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private rc: RoughCanvas;
  private options: Required<Pick<WhiteboardOptions, 'roughness' | 'strokeColor' | 'strokeWidth' | 'font' | 'fontSize' | 'backgroundColor' | 'animationSpeed'>>;
  private animationFrameId: number | null = null;
  private currentAnimationCancel: (() => void) | null = null;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, options: WhiteboardOptions = {}) {
    this.displayCanvas = canvas;
    this.displayCtx = canvas.getContext('2d')!;
    this.rc = rough.canvas(canvas);

    this.options = {
      roughness: options.roughness ?? 1,
      strokeColor: options.strokeColor ?? '#000000',
      strokeWidth: options.strokeWidth ?? 2,
      font: options.font ?? 'Segoe Print, Comic Sans MS, cursive',
      fontSize: options.fontSize ?? 18,
      backgroundColor: options.backgroundColor ?? '#fffef9',
      animationSpeed: options.animationSpeed ?? 1,
    };

    // Create offscreen persist canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      this.persistCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      this.persistCtx = this.persistCanvas.getContext('2d')!;
    } else {
      // Fallback for environments without OffscreenCanvas
      const fallback = document.createElement('canvas');
      fallback.width = canvas.width;
      fallback.height = canvas.height;
      this.persistCanvas = fallback;
      this.persistCtx = fallback.getContext('2d')!;
    }

    this.clearDisplay();
  }

  /** Resize the canvas to new logical dimensions at the given device pixel ratio. */
  resize(logicalW: number, logicalH: number, dpr = 1): void {
    this.dpr = dpr;
    const physW = Math.round(logicalW * dpr);
    const physH = Math.round(logicalH * dpr);

    // Save old persist canvas content
    const oldPersist = this.persistCanvas;

    // Resize display canvas
    this.displayCanvas.width = physW;
    this.displayCanvas.height = physH;
    this.displayCtx = this.displayCanvas.getContext('2d')!;
    this.displayCtx.scale(dpr, dpr);
    this.rc = rough.canvas(this.displayCanvas);

    // Recreate persist canvas at new physical size
    if (typeof OffscreenCanvas !== 'undefined') {
      this.persistCanvas = new OffscreenCanvas(physW, physH);
      this.persistCtx = this.persistCanvas.getContext('2d')!;
    } else {
      const fallback = document.createElement('canvas');
      fallback.width = physW;
      fallback.height = physH;
      this.persistCanvas = fallback;
      this.persistCtx = fallback.getContext('2d')!;
    }
    this.persistCtx.scale(dpr, dpr);

    // Copy old persist content (pixel-for-pixel)
    this.persistCtx.save();
    this.persistCtx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity for raw pixel copy
    this.persistCtx.drawImage(oldPersist as any, 0, 0);
    this.persistCtx.restore();

    this.compositeToDisplay();
  }

  getDpr(): number {
    return this.dpr;
  }

  /** Duration in ms for a given base duration, adjusted by animation speed */
  private duration(baseMs: number): number {
    return baseMs / this.options.animationSpeed;
  }

  /** Animate a line from (x1,y1) to (x2,y2) */
  async animateLine(
    x1: number, y1: number, x2: number, y2: number,
    color?: string, width?: number,
  ): Promise<void> {
    const strokeColor = color ?? this.options.strokeColor;
    const strokeWidth = width ?? this.options.strokeWidth;

    const drawable = this.rc.generator.line(x1, y1, x2, y2, {
      roughness: this.options.roughness,
      stroke: strokeColor,
      strokeWidth,
    });

    await this.animateDrawable(drawable, strokeColor, strokeWidth);
    this.commitDrawable(drawable, strokeColor, strokeWidth);
  }

  /** Animate a rectangle */
  async animateRect(
    x: number, y: number, w: number, h: number,
    color?: string, width?: number, fill?: string, fillStyle?: string,
  ): Promise<void> {
    const strokeColor = color ?? this.options.strokeColor;
    const strokeWidth = width ?? this.options.strokeWidth;

    const opts: any = {
      roughness: this.options.roughness,
      stroke: strokeColor,
      strokeWidth,
    };
    if (fill) {
      opts.fill = fill;
      opts.fillStyle = fillStyle ?? 'solid';
    }

    const drawable = this.rc.generator.rectangle(x, y, w, h, opts);
    await this.animateDrawable(drawable, strokeColor, strokeWidth);
    this.commitDrawable(drawable, strokeColor, strokeWidth, fill);
  }

  /** Animate a circle */
  async animateCircle(
    x: number, y: number, radius: number,
    color?: string, width?: number, fill?: string, fillStyle?: string,
  ): Promise<void> {
    const strokeColor = color ?? this.options.strokeColor;
    const strokeWidth = width ?? this.options.strokeWidth;
    const diameter = radius * 2;

    const opts: any = {
      roughness: this.options.roughness,
      stroke: strokeColor,
      strokeWidth,
    };
    if (fill) {
      opts.fill = fill;
      opts.fillStyle = fillStyle ?? 'solid';
    }

    const drawable = this.rc.generator.circle(x, y, diameter, opts);
    await this.animateDrawable(drawable, strokeColor, strokeWidth);
    this.commitDrawable(drawable, strokeColor, strokeWidth, fill);
  }

  /** Animate an ellipse */
  async animateEllipse(
    x: number, y: number, w: number, h: number,
    color?: string, width?: number, fill?: string, fillStyle?: string,
  ): Promise<void> {
    const strokeColor = color ?? this.options.strokeColor;
    const strokeWidth = width ?? this.options.strokeWidth;

    const opts: any = {
      roughness: this.options.roughness,
      stroke: strokeColor,
      strokeWidth,
    };
    if (fill) {
      opts.fill = fill;
      opts.fillStyle = fillStyle ?? 'solid';
    }

    const drawable = this.rc.generator.ellipse(x, y, w, h, opts);
    await this.animateDrawable(drawable, strokeColor, strokeWidth);
    this.commitDrawable(drawable, strokeColor, strokeWidth, fill);
  }

  /** Animate text with typewriter effect */
  async animateText(
    text: string, x: number, y: number,
    options?: { fontSize?: number; font?: string; color?: string },
  ): Promise<void> {
    const font = options?.font ?? this.options.font;
    const fontSize = options?.fontSize ?? this.options.fontSize;
    const color = options?.color ?? this.options.strokeColor;
    const dur = this.duration(text.length * 50); // ~50ms per char base

    // Create a temporary animation canvas for the text overlay
    await this.animateWithOverlay(
      (ctx) => TextRenderer.animate(ctx, text, x, y, { duration: dur, font, fontSize, color }),
    );

    // Commit text to persist canvas
    TextRenderer.drawText(
      this.persistCtx as CanvasRenderingContext2D,
      text, x, y, font, fontSize, color,
    );
    this.compositeToDisplay();
  }

  /** Clear everything */
  clear(): void {
    const { width, height } = this.displayCanvas;
    this.persistCtx.save();
    this.persistCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.persistCtx.clearRect(0, 0, width, height);
    this.persistCtx.restore();
    this.clearDisplay();
  }

  /** Update options dynamically */
  setOption<K extends keyof typeof this.options>(key: K, value: (typeof this.options)[K]): void {
    this.options[key] = value;
  }

  getOption<K extends keyof typeof this.options>(key: K): (typeof this.options)[K] {
    return this.options[key];
  }

  // ---- Private helpers ----

  private clearDisplay(): void {
    const { width, height } = this.displayCanvas;
    this.displayCtx.save();
    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.clearRect(0, 0, width, height);
    if (this.options.backgroundColor) {
      this.displayCtx.fillStyle = this.options.backgroundColor;
      this.displayCtx.fillRect(0, 0, width, height);
    }
    this.displayCtx.restore();
  }

  /** Composite persist canvas onto display canvas */
  private compositeToDisplay(): void {
    this.clearDisplay();
    this.displayCtx.save();
    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.drawImage(this.persistCanvas as any, 0, 0);
    this.displayCtx.restore();
  }

  /**
   * Animate a Rough.js drawable with progressive reveal.
   * During animation, each frame: clear display -> draw persist -> draw partial.
   */
  private async animateDrawable(
    drawable: Drawable,
    strokeColor: string,
    strokeWidth: number,
  ): Promise<void> {
    const ops = ProgressiveAnimator.extractOps(drawable);
    if (ops.length === 0) return;

    const segments = measureOps(ops);
    const totalLength = segments.length > 0
      ? segments[segments.length - 1].cumulativeLength
      : 0;

    if (totalLength === 0) return;

    // Base duration scales with total path length
    const baseDuration = Math.min(2000, Math.max(200, totalLength * 2));
    const dur = this.duration(baseDuration);

    return new Promise<void>((resolve) => {
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, elapsed / dur);
        const progress = easeOutCubic(rawProgress);
        const targetLength = progress * totalLength;

        // Composite: persist layer + progressive overlay
        this.compositeToDisplay();
        ProgressiveAnimator.drawOpsToLength(
          this.displayCtx, segments, targetLength, strokeColor, strokeWidth,
        );

        if (rawProgress < 1) {
          this.animationFrameId = requestAnimationFrame(tick);
        } else {
          this.animationFrameId = null;
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(tick);
    });
  }

  /**
   * Run an animation that draws onto a temporary overlay,
   * compositing persist + overlay each frame.
   */
  private async animateWithOverlay(
    animator: (ctx: CanvasRenderingContext2D) => Promise<void>,
  ): Promise<void> {
    // For text, we animate directly on the display context.
    // Each frame of the text animator will be drawn on top of the persist layer.
    // We set up a frame loop that composites persist first.

    const originalCtx = this.displayCtx;

    // We'll hook into rAF to composite before the text animator draws
    // Simple approach: let text animator draw on display, and we
    // re-composite persist before each text frame via a proxy approach.

    // Simpler: just animate on display canvas directly, with persist as base.
    // The text animator's rAF will re-draw partial text each frame.
    // We pre-composite persist, then the text frames draw on top.
    this.compositeToDisplay();
    await animator(originalCtx);
  }

  /** Commit a finished drawable to the persist canvas */
  private commitDrawable(
    drawable: Drawable,
    strokeColor: string,
    strokeWidth: number,
    fill?: string,
  ): void {
    const ops = ProgressiveAnimator.extractOps(drawable);
    this.drawAllOps(ops, strokeColor, strokeWidth);
    this.compositeToDisplay();
  }

  /** Draw all ops completely onto the persist canvas */
  private drawAllOps(
    ops: { op: string; data: number[] }[],
    strokeColor: string,
    strokeWidth: number,
  ): void {
    const ctx = this.persistCtx as CanvasRenderingContext2D;
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (const op of ops) {
      if (op.op === 'move') {
        ctx.moveTo(op.data[0], op.data[1]);
      } else if (op.op === 'lineTo') {
        ctx.lineTo(op.data[0], op.data[1]);
      } else if (op.op === 'bcurveTo') {
        ctx.bezierCurveTo(
          op.data[0], op.data[1],
          op.data[2], op.data[3],
          op.data[4], op.data[5],
        );
      }
    }

    ctx.stroke();
    ctx.restore();
  }
}
