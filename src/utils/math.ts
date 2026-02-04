import type { Point, DrawOp, MeasuredSegment } from '../types.js';

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Distance between two points */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Degrees to radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Evaluate a cubic bezier at parameter t using de Casteljau's algorithm.
 * Control points: p0, p1, p2, p3
 */
export function bezierPoint(
  p0: number, p1: number, p2: number, p3: number, t: number,
): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3;
}

/**
 * Approximate the arc length of a cubic bezier curve using subdivision.
 * Points: (x0,y0) -> (x1,y1) -> (x2,y2) -> (x3,y3)
 */
export function bezierLength(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  steps = 20,
): number {
  let len = 0;
  let prevX = x0;
  let prevY = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = bezierPoint(x0, x1, x2, x3, t);
    const cy = bezierPoint(y0, y1, y2, y3, t);
    len += distance(prevX, prevY, cx, cy);
    prevX = cx;
    prevY = cy;
  }
  return len;
}

/**
 * Subdivide a cubic bezier at parameter t, returning the first sub-curve's
 * control points using de Casteljau's algorithm.
 */
export function subdivideBezier(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number,
): [number, number, number, number, number, number, number, number] {
  const ax = lerp(x0, x1, t);
  const ay = lerp(y0, y1, t);
  const bx = lerp(x1, x2, t);
  const by = lerp(y1, y2, t);
  const cx = lerp(x2, x3, t);
  const cy = lerp(y2, y3, t);

  const dx = lerp(ax, bx, t);
  const dy = lerp(ay, by, t);
  const ex = lerp(bx, cx, t);
  const ey = lerp(by, cy, t);

  const fx = lerp(dx, ex, t);
  const fy = lerp(dy, ey, t);

  return [x0, y0, ax, ay, dx, dy, fx, fy];
}

/**
 * Measure all drawing ops, producing segments with cumulative arc lengths.
 * `cursorX/cursorY` tracks the current pen position for length calculations.
 */
export function measureOps(ops: DrawOp[]): MeasuredSegment[] {
  const segments: MeasuredSegment[] = [];
  let curX = 0;
  let curY = 0;
  let cumLen = 0;

  for (const op of ops) {
    let segLen = 0;

    if (op.op === 'move') {
      // move doesn't draw, length = 0
      curX = op.data[0];
      curY = op.data[1];
    } else if (op.op === 'lineTo') {
      const [tx, ty] = op.data;
      segLen = distance(curX, curY, tx, ty);
      curX = tx;
      curY = ty;
    } else if (op.op === 'bcurveTo') {
      const [cp1x, cp1y, cp2x, cp2y, ex, ey] = op.data;
      segLen = bezierLength(curX, curY, cp1x, cp1y, cp2x, cp2y, ex, ey);
      curX = ex;
      curY = ey;
    }

    cumLen += segLen;
    segments.push({ op, length: segLen, cumulativeLength: cumLen });
  }

  return segments;
}

/**
 * Given a target distance along measured segments, find the parameter t
 * within the segment that contains that distance.
 */
export function findSegmentAtDistance(
  segments: MeasuredSegment[],
  targetDist: number,
): { segmentIndex: number; localT: number } | null {
  if (segments.length === 0) return null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const prevCum = i > 0 ? segments[i - 1].cumulativeLength : 0;

    if (targetDist <= seg.cumulativeLength || i === segments.length - 1) {
      if (seg.length === 0) {
        return { segmentIndex: i, localT: 1 };
      }
      const localDist = targetDist - prevCum;
      const localT = Math.min(1, Math.max(0, localDist / seg.length));
      return { segmentIndex: i, localT };
    }
  }

  return { segmentIndex: segments.length - 1, localT: 1 };
}
