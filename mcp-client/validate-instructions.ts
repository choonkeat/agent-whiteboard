import type { Instruction, InstructionType } from '../src/types.js';

export interface ValidationError {
  index: number;
  type: unknown;
  message: string;
}

export interface ValidationResult {
  valid: Instruction[];
  errors: ValidationError[];
}

/** All valid instruction type strings */
const VALID_TYPES: Set<string> = new Set<string>([
  'moveTo',
  'lineTo',
  'forward',
  'turnLeft',
  'turnRight',
  'penUp',
  'penDown',
  'setColor',
  'setStrokeWidth',
  'drawRect',
  'drawCircle',
  'drawEllipse',
  'writeText',
  'label',
  'clear',
  'wait',
]);

/** Required fields per instruction type: fieldName → expected typeof */
const REQUIRED_FIELDS: Record<string, Record<string, string>> = {
  moveTo: { x: 'number', y: 'number' },
  lineTo: { x: 'number', y: 'number' },
  forward: { distance: 'number' },
  turnLeft: { angle: 'number' },
  turnRight: { angle: 'number' },
  penUp: {},
  penDown: {},
  setColor: { color: 'string' },
  setStrokeWidth: { width: 'number' },
  drawRect: { x: 'number', y: 'number', width: 'number', height: 'number' },
  drawCircle: { x: 'number', y: 'number', radius: 'number' },
  drawEllipse: { x: 'number', y: 'number', width: 'number', height: 'number' },
  writeText: { text: 'string', x: 'number', y: 'number' },
  label: { text: 'string' },
  clear: {},
  wait: { duration: 'number' },
};

/** Example JSON for each instruction type (used in error messages to help agents self-correct) */
const EXAMPLE_INSTRUCTIONS: Record<string, string> = {
  moveTo: '{"type":"moveTo","x":100,"y":100}',
  lineTo: '{"type":"lineTo","x":200,"y":200}',
  forward: '{"type":"forward","distance":50}',
  turnLeft: '{"type":"turnLeft","angle":90}',
  turnRight: '{"type":"turnRight","angle":90}',
  penUp: '{"type":"penUp"}',
  penDown: '{"type":"penDown"}',
  setColor: '{"type":"setColor","color":"#2196F3"}',
  setStrokeWidth: '{"type":"setStrokeWidth","width":2}',
  drawRect: '{"type":"drawRect","x":100,"y":100,"width":200,"height":80}',
  drawCircle: '{"type":"drawCircle","x":200,"y":200,"radius":50}',
  drawEllipse: '{"type":"drawEllipse","x":200,"y":200,"width":100,"height":60}',
  writeText: '{"type":"writeText","text":"Hello","x":100,"y":100}',
  label: '{"type":"label","text":"Label"}',
  clear: '{"type":"clear"}',
  wait: '{"type":"wait","duration":1000}',
};

/**
 * Suggest the closest valid type for a misspelled one.
 * Uses simple substring/prefix matching.
 */
function suggestType(input: string): string | null {
  const lower = input.toLowerCase();

  // Exact case-insensitive match
  for (const t of VALID_TYPES) {
    if (t.toLowerCase() === lower) return t;
  }

  // One is substring of the other
  for (const t of VALID_TYPES) {
    const tLower = t.toLowerCase();
    if (tLower.includes(lower) || lower.includes(tLower)) return t;
  }

  // Prefix match (at least 3 chars)
  if (lower.length >= 3) {
    for (const t of VALID_TYPES) {
      if (t.toLowerCase().startsWith(lower.slice(0, 3))) return t;
    }
  }

  return null;
}

/**
 * Validate an array of raw instruction objects.
 * Returns valid instructions (cast to Instruction) and any errors found.
 */
export function validateInstructions(raw: unknown[]): ValidationResult {
  const valid: Instruction[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];

    // Must be a non-null object
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({
        index: i,
        type: item,
        message:
          'instruction is not an object. Each instruction must be a JSON object like {"type":"moveTo","x":100,"y":100}',
      });
      continue;
    }

    const obj = item as Record<string, unknown>;

    // Must have a type field
    if (!('type' in obj) || typeof obj.type !== 'string') {
      errors.push({
        index: i,
        type: undefined,
        message:
          'missing or non-string "type" field. Each instruction needs a "type" field, e.g. {"type":"drawRect","x":100,"y":100,"width":200,"height":80}',
      });
      continue;
    }

    const typeName = obj.type;

    // Type must be valid
    if (!VALID_TYPES.has(typeName)) {
      const suggestion = suggestType(typeName);
      let hint = '';
      if (suggestion) {
        hint = `. Did you mean "${suggestion}"? Example: ${EXAMPLE_INSTRUCTIONS[suggestion]}`;
      }
      errors.push({
        index: i,
        type: typeName,
        message: `unknown type "${typeName}"${hint}`,
      });
      continue;
    }

    // Check required fields
    const fields = REQUIRED_FIELDS[typeName];
    const example = EXAMPLE_INSTRUCTIONS[typeName];
    let fieldError = false;
    for (const [field, expectedType] of Object.entries(fields)) {
      if (!(field in obj)) {
        errors.push({
          index: i,
          type: typeName,
          message: `missing required field "${field}" (expected ${expectedType}). Example: ${example}`,
        });
        fieldError = true;
        break;
      }
      if (typeof obj[field] !== expectedType) {
        errors.push({
          index: i,
          type: typeName,
          message: `field "${field}" has type ${typeof obj[field]}, expected ${expectedType}. Example: ${example}`,
        });
        fieldError = true;
        break;
      }
    }

    if (!fieldError) {
      valid.push(obj as unknown as Instruction);
    }
  }

  return { valid, errors };
}

/**
 * Format validation errors into agent-readable text.
 */
export function formatValidationErrors(errors: ValidationError[], totalCount: number): string {
  const lines = errors.map((e) => {
    const typeLabel = e.type !== undefined ? ` (type "${e.type}")` : '';
    return `  - Instruction #${e.index}${typeLabel}: ${e.message}`;
  });
  return `VALIDATION ERRORS (${errors.length} of ${totalCount} instructions were invalid and skipped):\n${lines.join('\n')}`;
}
