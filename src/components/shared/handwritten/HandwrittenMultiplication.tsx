import React, { useMemo } from "react";
import { COLORS, PX, PY, wobbly, colX, type El, type AgeTier, getTierConfig } from "./utils";
import { HandwrittenSVG } from "./HandwrittenSVG";

interface Props {
  a: number;
  b: number;
  tier?: AgeTier;
}

export function HandwrittenMultiplication({ a, b, tier = "upper-elementary" }: Props) {
  const cfg = getTierConfig(tier);
  const layout = useMemo(() => compute(a, b, cfg), [a, b, cfg]);

  return <HandwrittenSVG elements={layout.elements} width={layout.width} height={layout.height} tier={tier} />;
}

function compute(a: number, b: number, cfg: ReturnType<typeof getTierConfig>) {
  const { fontSize: FS, cellWidth: CW, rowHeight: RH } = cfg;
  const aStr = String(a);
  const bStr = String(b);
  const result = a * b;
  const rStr = String(result);

  const partials: number[] = [];
  for (let i = bStr.length - 1; i >= 0; i--) {
    partials.push(a * Number(bStr[i]));
  }

  const maxPartialLen = Math.max(...partials.map((p, i) => String(p).length + i));
  const cols = Math.max(aStr.length, bStr.length, rStr.length, maxPartialLen) + 1;

  const els: El[] = [];
  let sid = 300;
  const ns = () => sid++;
  const cx = (col: number) => colX(col, CW);
  const totalW = PX * 2 + cols * CW;

  // Row 0: first number
  const r0Y = PY + FS;
  for (let i = 0; i < aStr.length; i++) {
    const c = cols - 1 - (aStr.length - 1 - i);
    els.push({
      id: `a${i}`, type: "text", x: cx(c), y: r0Y,
      text: aStr[i], color: COLORS.main, fontSize: FS,
      delay: 0.3 + i * 0.12, seed: ns(),
    });
  }

  // Row 1: × + second number
  const r1Y = r0Y + RH;
  els.push({
    id: "op", type: "text", x: cx(0), y: r1Y,
    text: "×", color: COLORS.sign, fontSize: FS,
    delay: 0.7, seed: ns(),
  });
  for (let i = 0; i < bStr.length; i++) {
    const c = cols - 1 - (bStr.length - 1 - i);
    els.push({
      id: `b${i}`, type: "text", x: cx(c), y: r1Y,
      text: bStr[i], color: COLORS.sign, fontSize: FS,
      delay: 0.7 + (i + 1) * 0.12, seed: ns(),
    });
  }

  // First separator
  const sep1Y = r1Y + RH * 0.3;
  els.push({
    id: "sep1", type: "path", x: 0, y: 0,
    d: wobbly(PX - 4, sep1Y, PX + cols * CW + 4, sep1Y, ns()),
    color: COLORS.lineAlpha, strokeWidth: 2.5,
    delay: 1.2, seed: ns(),
  });

  // Partial products — blue
  let curY = sep1Y + FS + 4;
  partials.forEach((p, i) => {
    const pStr = String(p);
    const rightCol = cols - 1;
    const baseDelay = 1.6 + i * 1.2;

    for (let z = 0; z < i; z++) {
      const c = rightCol - z;
      els.push({
        id: `z${i}-${z}`, type: "text", x: cx(c), y: curY,
        text: "0", color: COLORS.mid, fontSize: Math.round(FS * 0.82),
        delay: baseDelay, seed: ns(),
      });
    }

    for (let d = 0; d < pStr.length; d++) {
      const c = rightCol - i - (pStr.length - 1 - d);
      els.push({
        id: `pp${i}-${d}`, type: "text", x: cx(c), y: curY,
        text: pStr[d], color: COLORS.mid, fontSize: FS,
        delay: baseDelay + (d + 1) * 0.12, seed: ns(),
      });
    }

    curY += RH;
  });

  // Second separator (if multiple partials)
  if (partials.length > 1) {
    const sep2Y = curY - RH * 0.7;
    els.push({
      id: "sep2", type: "path", x: 0, y: 0,
      d: wobbly(PX - 4, sep2Y, PX + cols * CW + 4, sep2Y, ns()),
      color: COLORS.lineAlpha, strokeWidth: 2.5,
      delay: 1.6 + partials.length * 1.2, seed: ns(),
    });
  }

  // Final result — placeholder, revealed last with pulse
  const resultDelay = 1.6 + partials.length * 1.2 + 0.5;
  for (let i = 0; i < rStr.length; i++) {
    const c = cols - 1 - (rStr.length - 1 - i);
    els.push({
      id: `r${i}`, type: "text", x: cx(c), y: curY,
      text: rStr[i], color: COLORS.result, bold: true, fontSize: FS,
      delay: resultDelay + i * 0.15, seed: ns(),
      isResult: i === rStr.length - 1,
      isPlaceholder: true,
    });
  }

  const totalH = curY + PY + 8;
  return { elements: els, width: totalW, height: totalH };
}

export default HandwrittenMultiplication;
