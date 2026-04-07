import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CW, RH, PX, PY, FS, COLORS, jit, wobbly, colX, type El } from "./utils";

interface Props {
  type: "addition" | "subtraction";
  a: number;
  b: number;
}

export function HandwrittenAddSub({ type, a, b }: Props) {
  const layout = useMemo(() => compute(type, a, b), [type, a, b]);

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
          transition={{ delay: el.delay, duration: 0.35 }}
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

function compute(type: "addition" | "subtraction", a: number, b: number) {
  const result = type === "addition" ? a + b : a - b;
  const aStr = String(a);
  const bStr = String(b);
  const rStr = String(Math.abs(result));

  const cols = Math.max(aStr.length, bStr.length, rStr.length) + 1; // +1 for operator
  const els: El[] = [];
  let sid = 200;
  const ns = () => sid++;

  const pad = (s: string, len: number) => s.padStart(len, " ");

  const aP = pad(aStr, cols - 1);
  const bP = pad(bStr, cols - 1);
  const rP = pad(rStr, cols - 1);

  // --- Compute carries for addition ---
  const carries: number[] = new Array(cols - 1).fill(0);
  if (type === "addition") {
    let c = 0;
    for (let i = cols - 2; i >= 0; i--) {
      const da = aP[i] === " " ? 0 : Number(aP[i]);
      const db = bP[i] === " " ? 0 : Number(bP[i]);
      const sum = da + db + c;
      c = Math.floor(sum / 10);
      if (c > 0 && i > 0) carries[i - 1] = c;
    }
  }

  const totalW = PX * 2 + cols * CW;

  // Row 0: carries (small, red)
  let hasCarries = carries.some((c) => c > 0);
  const carryRowH = hasCarries ? RH * 0.6 : 0;

  // Row 1: first number
  const r1Y = PY + carryRowH + FS;
  for (let i = 0; i < cols - 1; i++) {
    if (aP[i] !== " ") {
      els.push({
        id: `a${i}`, type: "text",
        x: colX(i + 1), y: r1Y,
        text: aP[i], color: COLORS.main,
        delay: 0, seed: ns(),
      });
    }
  }

  // Carries above first number
  for (let i = 0; i < carries.length; i++) {
    if (carries[i] > 0) {
      els.push({
        id: `c${i}`, type: "text",
        x: colX(i + 1), y: PY + carryRowH * 0.5,
        text: String(carries[i]), color: COLORS.sign,
        fontSize: 20,
        delay: 1.5, seed: ns(),
      });
    }
  }

  // Row 2: operator + second number
  const r2Y = r1Y + RH;
  // Operator
  els.push({
    id: "op", type: "text",
    x: colX(0), y: r2Y,
    text: type === "addition" ? "+" : "−",
    color: COLORS.sign, fontSize: FS,
    delay: 0.4, seed: ns(),
  });
  for (let i = 0; i < cols - 1; i++) {
    if (bP[i] !== " ") {
      els.push({
        id: `b${i}`, type: "text",
        x: colX(i + 1), y: r2Y,
        text: bP[i], color: COLORS.main,
        delay: 0.4, seed: ns(),
      });
    }
  }

  // Separator line
  const lineY = r2Y + RH * 0.3;
  els.push({
    id: "sep", type: "path", x: 0, y: 0,
    d: wobbly(PX - 4, lineY, PX + cols * CW + 4, lineY, ns()),
    color: COLORS.main, strokeWidth: 2.5,
    delay: 0.9, seed: ns(),
  });

  // Row 3: result
  const r3Y = lineY + FS + 4;
  for (let i = 0; i < cols - 1; i++) {
    if (rP[i] !== " ") {
      els.push({
        id: `r${i}`, type: "text",
        x: colX(i + 1), y: r3Y,
        text: rP[i], color: COLORS.result, bold: true,
        delay: 1.2 + i * 0.15, seed: ns(),
      });
    }
  }

  const totalH = r3Y + PY + 8;
  return { elements: els, width: totalW, height: totalH };
}

export default HandwrittenAddSub;
