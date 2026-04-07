import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CW, RH, PX, PY, FS, COLORS, jit, wobbly, colX, type El } from "./utils";

interface Props {
  a: number;
  b: number;
}

export function HandwrittenMultiplication({ a, b }: Props) {
  const layout = useMemo(() => compute(a, b), [a, b]);

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

function compute(a: number, b: number) {
  const aStr = String(a);
  const bStr = String(b);
  const result = a * b;
  const rStr = String(result);

  // Partial products
  const partials: number[] = [];
  for (let i = bStr.length - 1; i >= 0; i--) {
    partials.push(a * Number(bStr[i]));
  }

  // Max columns needed
  const maxPartialLen = Math.max(
    ...partials.map((p, i) => String(p).length + i)
  );
  const cols = Math.max(aStr.length, bStr.length, rStr.length, maxPartialLen) + 1;

  const els: El[] = [];
  let sid = 300;
  const ns = () => sid++;

  const totalW = PX * 2 + cols * CW;

  // Row 0: first number (right-aligned)
  const r0Y = PY + FS;
  for (let i = 0; i < aStr.length; i++) {
    const c = cols - 1 - (aStr.length - 1 - i);
    els.push({
      id: `a${i}`, type: "text",
      x: colX(c), y: r0Y,
      text: aStr[i], color: COLORS.main,
      delay: 0, seed: ns(),
    });
  }

  // Row 1: × + second number
  const r1Y = r0Y + RH;
  els.push({
    id: "op", type: "text",
    x: colX(0), y: r1Y,
    text: "×", color: COLORS.sign, fontSize: FS,
    delay: 0.3, seed: ns(),
  });
  for (let i = 0; i < bStr.length; i++) {
    const c = cols - 1 - (bStr.length - 1 - i);
    els.push({
      id: `b${i}`, type: "text",
      x: colX(c), y: r1Y,
      text: bStr[i], color: COLORS.main,
      delay: 0.3, seed: ns(),
    });
  }

  // First separator line
  const sep1Y = r1Y + RH * 0.3;
  els.push({
    id: "sep1", type: "path", x: 0, y: 0,
    d: wobbly(PX - 4, sep1Y, PX + cols * CW + 4, sep1Y, ns()),
    color: COLORS.main, strokeWidth: 2.5,
    delay: 0.7, seed: ns(),
  });

  // Partial products
  let curY = sep1Y + FS + 4;
  partials.forEach((p, i) => {
    const pStr = String(p);
    // Shifted by i zeros
    const totalDigits = pStr.length + i;
    const rightCol = cols - 1;

    // Zeros
    for (let z = 0; z < i; z++) {
      const c = rightCol - z;
      els.push({
        id: `z${i}-${z}`, type: "text",
        x: colX(c), y: curY,
        text: "0", color: COLORS.mid,
        fontSize: 28,
        delay: 0.9 + i * 0.8, seed: ns(),
      });
    }

    // Digits
    for (let d = 0; d < pStr.length; d++) {
      const c = rightCol - i - (pStr.length - 1 - d);
      els.push({
        id: `pp${i}-${d}`, type: "text",
        x: colX(c), y: curY,
        text: pStr[d], color: COLORS.mid,
        delay: 0.9 + i * 0.8, seed: ns(),
      });
    }

    curY += RH;
  });

  // Second separator (only if multiple partials)
  if (partials.length > 1) {
    const sep2Y = curY - RH * 0.7;
    els.push({
      id: "sep2", type: "path", x: 0, y: 0,
      d: wobbly(PX - 4, sep2Y, PX + cols * CW + 4, sep2Y, ns()),
      color: COLORS.main, strokeWidth: 2.5,
      delay: 0.9 + partials.length * 0.8, seed: ns(),
    });
  }

  // Final result
  const resultDelay = 0.9 + partials.length * 0.8 + 0.4;
  for (let i = 0; i < rStr.length; i++) {
    const c = cols - 1 - (rStr.length - 1 - i);
    els.push({
      id: `r${i}`, type: "text",
      x: colX(c), y: curY,
      text: rStr[i], color: COLORS.result, bold: true,
      delay: resultDelay + i * 0.12, seed: ns(),
    });
  }

  const totalH = curY + PY + 8;
  return { elements: els, width: totalW, height: totalH };
}

export default HandwrittenMultiplication;
