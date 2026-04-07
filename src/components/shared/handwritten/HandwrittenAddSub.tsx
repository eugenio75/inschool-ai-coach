import React, { useMemo } from "react";
import { COLORS, PX, PY, wobbly, colX, type El, type AgeTier, getTierConfig } from "./utils";
import { HandwrittenSVG } from "./HandwrittenSVG";

interface Props {
  type: "addition" | "subtraction";
  a: number;
  b: number;
  tier?: AgeTier;
}

export function HandwrittenAddSub({ type, a, b, tier = "upper-elementary" }: Props) {
  const cfg = getTierConfig(tier);
  const layout = useMemo(() => compute(type, a, b, cfg), [type, a, b, cfg]);

  return <HandwrittenSVG elements={layout.elements} width={layout.width} height={layout.height} tier={tier} />;
}

function compute(type: "addition" | "subtraction", a: number, b: number, cfg: ReturnType<typeof getTierConfig>) {
  const { fontSize: FS, cellWidth: CW, rowHeight: RH } = cfg;
  const result = type === "addition" ? a + b : a - b;
  const aStr = String(a);
  const bStr = String(b);
  const rStr = String(Math.abs(result));

  const cols = Math.max(aStr.length, bStr.length, rStr.length) + 1;
  const els: El[] = [];
  let sid = 200;
  const ns = () => sid++;
  const cx = (col: number) => colX(col, CW);
  const pad = (s: string, len: number) => s.padStart(len, " ");

  const aP = pad(aStr, cols - 1);
  const bP = pad(bStr, cols - 1);
  const rP = pad(rStr, cols - 1);

  // Carries for addition
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
  const hasCarries = carries.some((c) => c > 0);
  const carryRowH = hasCarries ? RH * 0.6 : 0;

  // Row 1: first number
  const r1Y = PY + carryRowH + FS;
  for (let i = 0; i < cols - 1; i++) {
    if (aP[i] !== " ") {
      els.push({
        id: `a${i}`, type: "text", x: cx(i + 1), y: r1Y,
        text: aP[i], color: COLORS.main, fontSize: FS,
        delay: 0.3 + i * 0.12, seed: ns(),
      });
    }
  }

  // Carries — red, small
  for (let i = 0; i < carries.length; i++) {
    if (carries[i] > 0) {
      els.push({
        id: `c${i}`, type: "text", x: cx(i + 1), y: PY + carryRowH * 0.5,
        text: String(carries[i]), color: COLORS.sign,
        fontSize: Math.round(FS * 0.55),
        delay: 2.0 + i * 0.3, seed: ns(),
      });
    }
  }

  // Row 2: operator + second number
  const r2Y = r1Y + RH;
  els.push({
    id: "op", type: "text", x: cx(0), y: r2Y,
    text: type === "addition" ? "+" : "−",
    color: COLORS.sign, fontSize: FS,
    delay: 0.8, seed: ns(),
  });
  for (let i = 0; i < cols - 1; i++) {
    if (bP[i] !== " ") {
      els.push({
        id: `b${i}`, type: "text", x: cx(i + 1), y: r2Y,
        text: bP[i], color: COLORS.main, fontSize: FS,
        delay: 0.8 + (i + 1) * 0.12, seed: ns(),
      });
    }
  }

  // Separator line
  const lineY = r2Y + RH * 0.3;
  els.push({
    id: "sep", type: "path", x: 0, y: 0,
    d: wobbly(PX - 4, lineY, PX + cols * CW + 4, lineY, ns()),
    color: COLORS.lineAlpha, strokeWidth: 2.5,
    delay: 1.5, seed: ns(),
  });

  // Row 3: result — placeholders first, then revealed progressively
  const r3Y = lineY + FS + 4;
  for (let i = 0; i < cols - 1; i++) {
    if (rP[i] !== " ") {
      els.push({
        id: `r${i}`, type: "text", x: cx(i + 1), y: r3Y,
        text: rP[i], color: COLORS.result, bold: true, fontSize: FS,
        delay: 2.0 + i * 0.4, seed: ns(),
        isResult: i === cols - 2, // last digit gets pulse
        isPlaceholder: true,
      });
    }
  }

  const totalH = r3Y + PY + 8;
  return { elements: els, width: totalW, height: totalH };
}

export default HandwrittenAddSub;
