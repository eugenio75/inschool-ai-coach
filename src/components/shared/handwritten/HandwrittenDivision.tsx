import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CW, RH, PX, PY, FS, COLORS, jit, wobbly, colX, type El } from "./utils";

interface Props {
  dividend: number;
  divisor: number;
}

export function HandwrittenDivision({ dividend, divisor }: Props) {
  const layout = useMemo(() => compute(dividend, divisor), [dividend, divisor]);

  return (
    <svg
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="my-3 max-w-full"
      style={{ overflow: "visible" }}
    >
      {layout.elements.map((el) => (
        <motion.g
          key={el.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: el.delay, duration: 0.4 }}
        >
          {el.type === "text" ? (
            <text
              x={el.x + jit(el.seed, 0.8)}
              y={el.y + jit(el.seed + 3, 0.5)}
              fill={el.color}
              fontSize={el.fontSize || FS}
              fontFamily="'Caveat', cursive"
              textAnchor="middle"
              dominantBaseline="auto"
              fontWeight={el.bold ? 700 : 400}
            >
              {el.text}
            </text>
          ) : (
            <path
              d={el.d!}
              fill="none"
              stroke={el.color}
              strokeWidth={el.strokeWidth || 2}
              strokeLinecap="round"
            />
          )}
        </motion.g>
      ))}
    </svg>
  );
}

function compute(dividend: number, divisor: number) {
  const dStr = String(dividend);
  const dLen = dStr.length;
  const dvStr = String(divisor);
  const els: El[] = [];
  let sid = 100;
  const ns = () => sid++;

  // --- Division computation ---
  let carry = 0;
  let qStr = "";
  interface Step {
    qDigit: string;
    product: number;
    carryBefore: number;
    remainder: number;
    rightIdx: number;
  }
  const steps: Step[] = [];

  for (let i = 0; i < dLen; i++) {
    carry = carry * 10 + Number(dStr[i]);
    const q = Math.floor(carry / divisor);
    const prod = q * divisor;
    const rem = carry - prod;

    if (q > 0 || steps.length > 0) {
      steps.push({
        qDigit: String(q),
        product: prod,
        carryBefore: carry,
        remainder: rem,
        rightIdx: i,
      });
    }
    qStr += String(q);
    carry = rem;
  }
  qStr = qStr.replace(/^0+/, "") || "0";

  // --- Positions ---
  const bracketX = PX + dLen * CW + 12;
  const rightCols = Math.max(dvStr.length, qStr.length);
  const totalW = bracketX + rightCols * CW + 20 + PX;

  // Row 0: dividend
  const row0Y = PY + FS;
  for (let i = 0; i < dLen; i++) {
    els.push({
      id: `d${i}`, type: "text",
      x: colX(i), y: row0Y,
      text: dStr[i], color: COLORS.main, delay: 0, seed: ns(),
    });
  }

  // Bracket: vertical line
  els.push({
    id: "bv", type: "path", x: 0, y: 0,
    d: wobbly(bracketX, PY + 2, bracketX, PY + RH + 8, ns()),
    color: COLORS.main, strokeWidth: 2.5, delay: 0, seed: ns(),
  });

  // Bracket: horizontal line
  const hRight = bracketX + rightCols * CW + 14;
  els.push({
    id: "bh", type: "path", x: 0, y: 0,
    d: wobbly(bracketX, PY + RH + 8, hRight, PY + RH + 8, ns()),
    color: COLORS.main, strokeWidth: 2.5, delay: 0, seed: ns(),
  });

  // Divisor digits
  for (let i = 0; i < dvStr.length; i++) {
    els.push({
      id: `dv${i}`, type: "text",
      x: bracketX + 16 + i * CW + CW / 2, y: row0Y,
      text: dvStr[i], color: COLORS.main, delay: 0, seed: ns(),
    });
  }

  // --- Steps ---
  let leftRow = 1;
  let groupDelay = 0.6;

  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];
    const d = groupDelay;

    // Quotient digit on the right
    const qPos = step.rightIdx - steps[0].rightIdx;
    els.push({
      id: `q${s}`, type: "text",
      x: bracketX + 16 + qPos * CW + CW / 2,
      y: PY + RH + 8 + FS,
      text: step.qDigit, color: COLORS.result, bold: true,
      delay: d, seed: ns(),
    });

    // Bring-down number (shown for steps after the first)
    if (s > 0) {
      const cbStr = String(step.carryBefore);
      for (let i = 0; i < cbStr.length; i++) {
        const cx = colX(step.rightIdx - (cbStr.length - 1 - i));
        els.push({
          id: `cb${s}-${i}`, type: "text",
          x: cx, y: PY + leftRow * RH + FS,
          text: cbStr[i], color: COLORS.mid,
          delay: d - 0.2, seed: ns(),
        });
      }
      leftRow++;
    }

    // Minus sign + product
    const pStr = String(step.product);
    const pLeftCol = step.rightIdx - pStr.length + 1;

    // Minus sign one column left of product
    els.push({
      id: `m${s}`, type: "text",
      x: colX(pLeftCol - 1), y: PY + leftRow * RH + FS,
      text: "−", color: COLORS.sign, fontSize: FS,
      delay: d + 0.3, seed: ns(),
    });

    // Product digits
    for (let i = 0; i < pStr.length; i++) {
      els.push({
        id: `p${s}-${i}`, type: "text",
        x: colX(pLeftCol + i), y: PY + leftRow * RH + FS,
        text: pStr[i], color: COLORS.main,
        delay: d + 0.3, seed: ns(),
      });
    }
    leftRow++;

    // Separator line (hand-drawn)
    const lineY = PY + leftRow * RH - 6;
    const lineL = colX(pLeftCol - 1) - CW / 2 + 4;
    const lineR = colX(step.rightIdx) + CW / 2 + 2;
    els.push({
      id: `l${s}`, type: "path", x: 0, y: 0,
      d: wobbly(lineL, lineY, lineR, lineY, ns()),
      color: COLORS.main, strokeWidth: 2,
      delay: d + 0.5, seed: ns(),
    });

    // Remainder (for last step, or implicit for next bring-down)
    if (s === steps.length - 1) {
      const rStr = String(step.remainder);
      for (let i = 0; i < rStr.length; i++) {
        const cx = colX(step.rightIdx - (rStr.length - 1 - i));
        els.push({
          id: `r${s}-${i}`, type: "text",
          x: cx, y: PY + leftRow * RH + FS,
          text: rStr[i], color: COLORS.mid, bold: true,
          delay: d + 0.7, seed: ns(),
        });
      }
      leftRow++;
    }

    groupDelay += 1.2;
  }

  const totalH = PY + (leftRow + 0.5) * RH;
  return { elements: els, width: totalW, height: totalH };
}

export default HandwrittenDivision;
