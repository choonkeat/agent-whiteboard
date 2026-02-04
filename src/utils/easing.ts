/** Linear (no easing) */
export function linear(t: number): number {
  return t;
}

/** Ease in (quadratic) */
export function easeIn(t: number): number {
  return t * t;
}

/** Ease out (quadratic) */
export function easeOut(t: number): number {
  return t * (2 - t);
}

/** Ease in-out (quadratic) */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : -1 + (4 - 2 * t) * t;
}

/** Ease out cubic — nice for drawing animations */
export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}
