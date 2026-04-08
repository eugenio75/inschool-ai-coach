import React, { useMemo } from "react";
import { COLORS, PX, PY, wobbly, colX, type El, type AgeTier, getTierConfig, type CellHighlight, getHighlightHex } from "./utils";
import { HandwrittenSVG } from "./HandwrittenSVG";

interface Props {
  dividend: number;
  divisor: number;
  tier?: AgeTier;
  partial?: boolean;
  filledCells?: number;
  /** Sub-step within the current step: 0=ask containment, 1=show quotient, 2=show product, 3=show remainder (last only) */
  subStep?: number;
  highlights?: CellHighlight[];
}

export function HandwrittenDivision({ dividend, divisor, tier = "upper-elementary", partial = false, filledCells, subStep, highlights }: Props) {
  const cfg = getTierConfig(tier);
  const layout = useMemo(
    () => compute(dividend, divisor, cfg, partial, filledCells, subStep, highlights),
    [dividend, divisor, cfg, partial, filledCells, subStep, highlights]
  );

  return <HandwrittenSVG elements={layout.elements} width={layout.width} height={layout.height} tier={tier} />;
}

function applyHighlights(els: El[], highlights?: CellHighlight[]): El[] {
  if (!highlights || highlights.length === 0) return els;
  const map = new Map(highlights.map(h => [h.cellId, getHighlightHex(h.color)]));
  return els.map(el => {
    const hc = map.get(el.id);
    if (hc) return { ...el, highlightColor: hc };
    return el;
  });
}

/**
 * Determine if an element type is visible for a given step.
 * - Steps before maxFilled: fully visible (completed)
 * - Step at maxFilled: controlled by currentSubStep
 * - Steps after maxFilled: hidden
 */
function isElementVisible(
  partial: boolean,
  stepIdx: number,
  maxFilled: number,
  currentSubStep: number,
  elementType: "bringdown" | "quotient" | "product" | "remainder",
): boolean {
  if (!partial) return true;
  if (stepIdx < maxFilled) return true;
  if (stepIdx > maxFilled) return false;
  // stepIdx === maxFilled (current step)
  switch (elementType) {
    case "bringdown": return true; // visible when entering this step
    case "quotient": return currentSubStep >= 1;
    case "product": return currentSubStep >= 2;
    case "remainder": return currentSubStep >= 3;
  }
}

function compute(
  dividend: number,
  divisor: number,
  cfg: ReturnType<typeof getTierConfig>,
  partial: boolean,
  filledCells?: number,
  subStep?: number,
  highlights?: CellHighlight[],
) {
  const { fontSize: FS, cellWidth: CW, rowHeight: RH } = cfg;
  const dStr = String(dividend);
  const dLen = dStr.length;
  const dvStr = String(divisor);
  const els: El[] = [];
  let sid = 100;
  const ns = () => sid++;
  const cx = (col: number) => colX(col, CW);

  // --- Division computation ---
  let carry = 0;
  let qStr = "";
  interface Step { qDigit: string; product: number; carryBefore: number; remainder: number; rightIdx: number; }
  const steps: Step[] = [];

  for (let i = 0; i < dLen; i++) {
    carry = carry * 10 + Number(dStr[i]);
    const q = Math.floor(carry / divisor);
    const prod = q * divisor;
    const rem = carry - prod;
    if (q > 0 || steps.length > 0) {
      steps.push({ qDigit: String(q), product: prod, carryBefore: carry, remainder: rem, rightIdx: i });
    }
    qStr += String(q);
    carry = rem;
  }
  qStr = qStr.replace(/^0+/, "") || "0";

  // --- Positions ---
  const bracketX = PX + dLen * CW + 12;
  const rightCols = Math.max(dvStr.length, qStr.length);
  const totalW = bracketX + rightCols * CW + 20 + PX;

  // Granularity: maxFilled = completed steps, currentSubStep = progress within current step
  const maxFilled = partial ? (filledCells ?? 0) : Infinity;
  // Default subStep to 4 (show everything) for backward compat when not specified
  const currentSubStep = partial ? (subStep ?? 4) : Infinity;

  // Row 0: dividend — always visible
  const row0Y = PY + FS;
  for (let i = 0; i < dLen; i++) {
    els.push({
      id: `d${i}`, type: "text", x: cx(i), y: row0Y,
      text: dStr[i], color: COLORS.main, fontSize: FS, delay: 0.3 + i * 0.15, seed: ns(),
    });
  }

  // Bracket: vertical line
  els.push({
    id: "bv", type: "path", x: 0, y: 0,
    d: wobbly(bracketX, PY + 2, bracketX, PY + RH + 8, ns()),
    color: COLORS.lineAlpha, strokeWidth: 2.5, delay: 0.8, seed: ns(),
  });

  // Bracket: horizontal line
  const hRight = bracketX + rightCols * CW + 14;
  els.push({
    id: "bh", type: "path", x: 0, y: 0,
    d: wobbly(bracketX, PY + RH + 8, hRight, PY + RH + 8, ns()),
    color: COLORS.lineAlpha, strokeWidth: 2.5, delay: 1.0, seed: ns(),
  });

  // Divisor digits — in red (always visible)
  for (let i = 0; i < dvStr.length; i++) {
    els.push({
      id: `dv${i}`, type: "text", x: bracketX + 16 + i * CW + CW / 2, y: row0Y,
      text: dvStr[i], color: COLORS.sign, fontSize: FS, delay: 0.5 + i * 0.15, seed: ns(),
    });
  }

  // --- Quotient digits ---
  for (let s = 0; s < steps.length; s++) {
    const qPos = steps[s].rightIdx - steps[0].rightIdx;
    const qDelay = 1.8 + s * 1.8;
    const qVisible = isElementVisible(partial, s, maxFilled, currentSubStep, "quotient");
    els.push({
      id: `qp${s}`, type: "text",
      x: bracketX + 16 + qPos * CW + CW / 2, y: PY + RH + 8 + FS,
      text: steps[s].qDigit, color: COLORS.result, bold: true, fontSize: FS,
      delay: qDelay, seed: ns(),
      isResult: s === steps.length - 1,
      isPlaceholder: qVisible,
      isHidden: !qVisible,
    });
  }

  // --- Steps (intermediate work) ---
  let leftRow = 1;
  let groupDelay = 1.8;

  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];
    const d = groupDelay;

    const bdVisible = isElementVisible(partial, s, maxFilled, currentSubStep, "bringdown");
    const prodVisible = isElementVisible(partial, s, maxFilled, currentSubStep, "product");
    const remVisible = isElementVisible(partial, s, maxFilled, currentSubStep, "remainder");

    // Bring-down number — amber (only for s > 0)
    if (s > 0) {
      const cbStr = String(step.carryBefore);
      for (let i = 0; i < cbStr.length; i++) {
        const colPos = step.rightIdx - (cbStr.length - 1 - i);
        els.push({
          id: `cb${s}-${i}`, type: "text", x: cx(colPos), y: PY + leftRow * RH + FS,
          text: cbStr[i], color: COLORS.bringDown, fontSize: FS,
          delay: d - 0.3, seed: ns(),
          isHidden: !bdVisible,
        });
      }
      leftRow++;
    }

    // Minus sign — red
    const pStr = String(step.product);
    const pLeftCol = step.rightIdx - pStr.length + 1;

    els.push({
      id: `m${s}`, type: "text", x: cx(pLeftCol - 1), y: PY + leftRow * RH + FS,
      text: "−", color: COLORS.sign, fontSize: FS,
      delay: d + 0.5, seed: ns(),
      isHidden: !prodVisible,
    });

    // Product digits
    for (let i = 0; i < pStr.length; i++) {
      els.push({
        id: `p${s}-${i}`, type: "text", x: cx(pLeftCol + i), y: PY + leftRow * RH + FS,
        text: pStr[i], color: COLORS.main, fontSize: FS,
        delay: d + 0.5 + (i + 1) * 0.15, seed: ns(),
        isHidden: !prodVisible,
      });
    }
    leftRow++;

    // Separator line — only when product is visible
    const lineY = PY + leftRow * RH - 6;
    const lineL = cx(pLeftCol - 1) - CW / 2 + 4;
    const lineR = cx(step.rightIdx) + CW / 2 + 2;
    if (prodVisible) {
      els.push({
        id: `l${s}`, type: "path", x: 0, y: 0,
        d: wobbly(lineL, lineY, lineR, lineY, ns()),
        color: COLORS.lineAlpha, strokeWidth: 2,
        delay: d + 1.0, seed: ns(),
      });
    }

    // Final remainder — only for last step, controlled by subStep
    if (s === steps.length - 1) {
      const rStr = String(step.remainder);
      for (let i = 0; i < rStr.length; i++) {
        const colPos = step.rightIdx - (rStr.length - 1 - i);
        els.push({
          id: `r${s}-${i}`, type: "text", x: cx(colPos), y: PY + leftRow * RH + FS,
          text: rStr[i], color: COLORS.mid, bold: true, fontSize: FS,
          delay: d + 1.3, seed: ns(), isResult: true,
          isHidden: !remVisible,
        });
      }
      leftRow++;
    }

    groupDelay += 1.8;
  }

  const totalH = PY + (leftRow + 0.5) * RH;
  const finalEls = applyHighlights(els, highlights);
  return { elements: finalEls, width: totalW, height: totalH };
}

export default HandwrittenDivision;
