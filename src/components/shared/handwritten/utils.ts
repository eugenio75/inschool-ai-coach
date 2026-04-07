/** Shared constants and helpers for handwritten SVG math components */

export const CW = 30;   // cell width per digit
export const RH = 44;   // row height
export const PX = 24;   // padding x
export const PY = 20;   // padding y
export const FS = 34;   // font size

export const COLORS = {
  main: "#2C2C2A",
  result: "#1D9E75",
  mid: "#378ADD",
  sign: "#E57373",
};

/** Deterministic jitter for hand-drawn feel */
export function jit(seed: number, amt = 1.2): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return ((x - Math.floor(x)) - 0.5) * amt * 2;
}

/** Wobbly quadratic bezier path between two points */
export function wobbly(
  x1: number, y1: number,
  x2: number, y2: number,
  seed: number,
): string {
  const cx = (x1 + x2) / 2 + jit(seed, 2.5);
  const cy = (y1 + y2) / 2 + jit(seed + 7, 1.8);
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

/** Center-x position for a digit at column index */
export function colX(col: number): number {
  return PX + col * CW + CW / 2;
}

export interface El {
  id: string;
  type: "text" | "path";
  x: number;
  y: number;
  text?: string;
  color: string;
  fontSize?: number;
  bold?: boolean;
  d?: string;
  strokeWidth?: number;
  delay: number;
  seed: number;
}
