import type { DrawOp, MeasuredSegment } from '../types.js';
import { measureOps, findSegmentAtDistance, subdivideBezier } from '../utils/math.js';
import { easeOutCubic } from '../utils/easing.js';

/**
 * Core animation engine: progressively draws Rough.js drawable operations
 * onto a canvas context over a specified duration.
 *
 * How it works:
 * 1. Takes a list of drawing ops (move, lineTo, bcurveTo) from a Rough.js Drawable
 * 2. Computes cumulative arc lengths
 * 3. On each rAF frame, draws ops up to `progress * totalLength`
 * 4. For partial bezier curves, uses de Casteljau subdivision
 */
export class ProgressiveAnimator {
  /**
   * Animate a set of drawing ops onto the given canvas context.
   * Returns a promise that resolves when the animation completes.
   */
  static animate(
    ctx: CanvasRenderingContext2D,
    ops: DrawOp[],
    options: {
      duration: number;
      strokeColor: string;
      strokeWidth: number;
      easing?: (t: number) => number;
    },
  ): Promise<void> {
    const { duration, strokeColor, strokeWidth, easing = easeOutCubic } = options;
    const segments = measureOps(ops);
    const totalLength = segments.length > 0
      ? segments[segments.length - 1].cumulativeLength
      : 0;

    if (totalLength === 0 || duration <= 0) {
      // Draw everything at once
      ProgressiveAnimator.drawOpsToLength(ctx, segments, totalLength, strokeColor, strokeWidth);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, elapsed / duration);
        const progress = easing(rawProgress);
        const targetLength = progress * totalLength;

        ProgressiveAnimator.drawOpsToLength(ctx, segments, targetLength, strokeColor, strokeWidth);

        if (rawProgress < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  /**
   * Draw ops up to a given arc length onto the context.
   * This re-draws from the beginning each frame (the caller is expected
   * to clear or use layering).
   */
  static drawOpsToLength(
    ctx: CanvasRenderingContext2D,
    segments: MeasuredSegment[],
    targetLength: number,
    strokeColor: string,
    strokeWidth: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let curX = 0;
    let curY = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const prevCum = i > 0 ? segments[i - 1].cumulativeLength : 0;

      if (prevCum > targetLength) break;

      const { op } = seg;

      if (op.op === 'move') {
        curX = op.data[0];
        curY = op.data[1];
        ctx.moveTo(curX, curY);
        continue;
      }

      if (seg.cumulativeLength <= targetLength) {
        // Draw this segment fully
        if (op.op === 'lineTo') {
          curX = op.data[0];
          curY = op.data[1];
          ctx.lineTo(curX, curY);
        } else if (op.op === 'bcurveTo') {
          const [cp1x, cp1y, cp2x, cp2y, ex, ey] = op.data;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
          curX = ex;
          curY = ey;
        }
      } else {
        // Partial segment
        const localDist = targetLength - prevCum;
        const localT = seg.length > 0 ? Math.min(1, localDist / seg.length) : 1;

        if (op.op === 'lineTo') {
          const tx = curX + (op.data[0] - curX) * localT;
          const ty = curY + (op.data[1] - curY) * localT;
          ctx.lineTo(tx, ty);
          curX = tx;
          curY = ty;
        } else if (op.op === 'bcurveTo') {
          const [cp1x, cp1y, cp2x, cp2y, ex, ey] = op.data;
          const sub = subdivideBezier(
            curX, curY, cp1x, cp1y, cp2x, cp2y, ex, ey, localT,
          );
          // sub = [x0, y0, cp1x', cp1y', cp2x', cp2y', ex', ey']
          ctx.bezierCurveTo(sub[2], sub[3], sub[4], sub[5], sub[6], sub[7]);
          curX = sub[6];
          curY = sub[7];
        }
        break;
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Extract DrawOps from a Rough.js Drawable's opSets.
   */
  static extractOps(drawable: any): DrawOp[] {
    const ops: DrawOp[] = [];
    if (!drawable || !drawable.sets) return ops;

    for (const opSet of drawable.sets) {
      if (!opSet.ops) continue;
      for (const op of opSet.ops) {
        if (op.op === 'move' || op.op === 'lineTo' || op.op === 'bcurveTo') {
          ops.push({ op: op.op, data: op.data });
        }
      }
    }
    return ops;
  }
}
