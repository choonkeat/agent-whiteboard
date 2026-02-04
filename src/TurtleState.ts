import { degToRad } from './utils/math.js';

/**
 * Manages turtle position, heading, pen state, and drawing style.
 * Heading is in degrees: 0 = up (north), 90 = right (east).
 */
export class TurtleState {
  x: number;
  y: number;
  heading: number; // degrees, 0 = up
  penDown: boolean;
  color: string;
  strokeWidth: number;

  constructor(
    x = 0,
    y = 0,
    heading = 0,
    color = '#000000',
    strokeWidth = 2,
  ) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.penDown = true;
    this.color = color;
    this.strokeWidth = strokeWidth;
  }

  /** Move forward by `distance` pixels in current heading direction.
   *  Returns the destination point. */
  forward(dist: number): { x: number; y: number } {
    // heading 0 = up, so dx = sin(heading), dy = -cos(heading)
    const rad = degToRad(this.heading);
    const nx = this.x + dist * Math.sin(rad);
    const ny = this.y - dist * Math.cos(rad);
    this.x = nx;
    this.y = ny;
    return { x: nx, y: ny };
  }

  turnLeft(degrees: number): void {
    this.heading = (this.heading - degrees) % 360;
    if (this.heading < 0) this.heading += 360;
  }

  turnRight(degrees: number): void {
    this.heading = (this.heading + degrees) % 360;
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  reset(centerX = 0, centerY = 0): void {
    this.x = centerX;
    this.y = centerY;
    this.heading = 0;
    this.penDown = true;
    this.color = '#000000';
    this.strokeWidth = 2;
  }
}
