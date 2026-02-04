/** Instruction types the whiteboard understands */
export type InstructionType =
  | 'moveTo'
  | 'lineTo'
  | 'forward'
  | 'turnLeft'
  | 'turnRight'
  | 'penUp'
  | 'penDown'
  | 'setColor'
  | 'setStrokeWidth'
  | 'drawRect'
  | 'drawCircle'
  | 'drawEllipse'
  | 'writeText'
  | 'label'
  | 'clear'
  | 'wait';

/** Base instruction shape */
export interface BaseInstruction {
  type: InstructionType;
}

export interface MoveToInstruction extends BaseInstruction {
  type: 'moveTo';
  x: number;
  y: number;
}

export interface LineToInstruction extends BaseInstruction {
  type: 'lineTo';
  x: number;
  y: number;
}

export interface ForwardInstruction extends BaseInstruction {
  type: 'forward';
  distance: number;
}

export interface TurnLeftInstruction extends BaseInstruction {
  type: 'turnLeft';
  angle: number;
}

export interface TurnRightInstruction extends BaseInstruction {
  type: 'turnRight';
  angle: number;
}

export interface PenUpInstruction extends BaseInstruction {
  type: 'penUp';
}

export interface PenDownInstruction extends BaseInstruction {
  type: 'penDown';
}

export interface SetColorInstruction extends BaseInstruction {
  type: 'setColor';
  color: string;
}

export interface SetStrokeWidthInstruction extends BaseInstruction {
  type: 'setStrokeWidth';
  width: number;
}

export interface DrawRectInstruction extends BaseInstruction {
  type: 'drawRect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  fillStyle?: string;
}

export interface DrawCircleInstruction extends BaseInstruction {
  type: 'drawCircle';
  x: number;
  y: number;
  radius: number;
  fill?: string;
  fillStyle?: string;
}

export interface DrawEllipseInstruction extends BaseInstruction {
  type: 'drawEllipse';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  fillStyle?: string;
}

export interface WriteTextInstruction extends BaseInstruction {
  type: 'writeText';
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  font?: string;
}

export interface LabelInstruction extends BaseInstruction {
  type: 'label';
  text: string;
  offsetX?: number;
  offsetY?: number;
  fontSize?: number;
}

export interface ClearInstruction extends BaseInstruction {
  type: 'clear';
}

export interface WaitInstruction extends BaseInstruction {
  type: 'wait';
  duration: number;
}

export type Instruction =
  | MoveToInstruction
  | LineToInstruction
  | ForwardInstruction
  | TurnLeftInstruction
  | TurnRightInstruction
  | PenUpInstruction
  | PenDownInstruction
  | SetColorInstruction
  | SetStrokeWidthInstruction
  | DrawRectInstruction
  | DrawCircleInstruction
  | DrawEllipseInstruction
  | WriteTextInstruction
  | LabelInstruction
  | ClearInstruction
  | WaitInstruction;

/** Configuration options for the whiteboard */
export interface WhiteboardOptions {
  /** Animation speed multiplier (1 = normal, 2 = double speed, etc.) */
  animationSpeed?: number;
  /** Rough.js roughness parameter (0 = smooth, higher = sketchier) */
  roughness?: number;
  /** Default stroke color */
  strokeColor?: string;
  /** Default stroke width */
  strokeWidth?: number;
  /** Default font for text */
  font?: string;
  /** Default font size */
  fontSize?: number;
  /** Background color (null = transparent) */
  backgroundColor?: string | null;
}

/** Event callbacks */
export interface WhiteboardEvents {
  onInstructionStart?: (instruction: Instruction, index: number) => void;
  onInstructionComplete?: (instruction: Instruction, index: number) => void;
  onQueueEmpty?: () => void;
}

/** A 2D point */
export interface Point {
  x: number;
  y: number;
}

/** Internal drawing operation extracted from Rough.js OpSet */
export interface DrawOp {
  op: 'move' | 'lineTo' | 'bcurveTo';
  data: number[];
}

/** Segment with precomputed arc length */
export interface MeasuredSegment {
  op: DrawOp;
  length: number;
  cumulativeLength: number;
}
