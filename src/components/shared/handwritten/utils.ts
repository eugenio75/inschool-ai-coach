/** Shared constants and helpers for handwritten SVG math components */

export const CW = 30;   // cell width per digit
export const RH = 44;   // row height
export const PX = 24;   // padding x
export const PY = 20;   // padding y
export const FS = 34;   // font size (default, overridden by age tier)

export const COLORS = {
  main: "#2C2C2A",
  result: "#1D9E75",
  mid: "#378ADD",
  sign: "#E57373",
  bringDown: "#BA7517",
  annotation: "#7F77DD",
  lineAlpha: "rgba(44,44,42,0.6)",
};

/** Age-adaptive tier configuration */
export type AgeTier = "lower-elementary" | "upper-elementary" | "middle" | "high";

export interface TierConfig {
  fontSize: number;
  cellWidth: number;
  rowHeight: number;
  timingMultiplier: number; // >1 = slower, <1 = faster
}

const TIER_CONFIGS: Record<AgeTier, TierConfig> = {
  "lower-elementary": { fontSize: 42, cellWidth: 38, rowHeight: 52, timingMultiplier: 1.3 },
  "upper-elementary": { fontSize: 36, cellWidth: 32, rowHeight: 46, timingMultiplier: 1.0 },
  "middle":           { fontSize: 30, cellWidth: 28, rowHeight: 40, timingMultiplier: 0.8 },
  "high":             { fontSize: 26, cellWidth: 24, rowHeight: 36, timingMultiplier: 0.6 },
};

export function getTierConfig(tier: AgeTier): TierConfig {
  return TIER_CONFIGS[tier];
}

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
export function colX(col: number, cw = CW): number {
  return PX + col * cw + cw / 2;
}

/** Path length for stroke-draw animation */
export function pathLength(d: string): number {
  // Approximation — for wobbly paths, use distance between endpoints × 1.1
  const match = d.match(/M([\d.]+),([\d.]+).*?([\d.]+),([\d.]+)$/);
  if (!match) return 100;
  const dx = parseFloat(match[3]) - parseFloat(match[1]);
  const dy = parseFloat(match[4]) - parseFloat(match[2]);
  return Math.sqrt(dx * dx + dy * dy) * 1.1;
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
  isResult?: boolean; // pulse animation on final result
}
