import React, { useMemo } from "react";

export interface ColumnOperationProps {
  type: "multiplication" | "division" | "addition" | "subtraction";
  numbers: number[];
}

const CELL = 36;
const BORDER = "1px solid hsl(var(--border))";
const THICK = "2px solid hsl(var(--foreground))";

function digits(n: number): string[] {
  return String(n).split("");
}

/* ─── Addition / Subtraction ─── */
function AddSubGrid({ numbers, type }: { numbers: number[]; type: "addition" | "subtraction" }) {
  const [a, b] = numbers;
  const result = type === "addition" ? a + b : a - b;
  const dA = digits(a);
  const dB = digits(b);
  const dR = digits(Math.abs(result));
  const cols = Math.max(dA.length, dB.length, dR.length) + 1; // +1 for operator

  const pad = (d: string[], len: number) => {
    const p = Array(len - d.length).fill("");
    return [...p, ...d];
  };

  const rowA = ["", ...pad(dA, cols - 1)];
  const rowB = [type === "addition" ? "+" : "−", ...pad(dB, cols - 1)];
  const rowR = ["", ...pad(dR, cols - 1)];

  return (
    <div className="inline-block my-2">
      <table className="border-collapse" style={{ fontFamily: "monospace" }}>
        <tbody>
          <Row cells={rowA} />
          <Row cells={rowB} />
          <SeparatorRow cols={cols} />
          <Row cells={rowR} bold />
        </tbody>
      </table>
    </div>
  );
}

/* ─── Multiplication ─── */
function MultiplicationGrid({ numbers }: { numbers: number[] }) {
  const [a, b] = numbers;
  const dA = digits(a);
  const dB = digits(b);
  const result = a * b;
  const dR = digits(result);

  const partials: number[] = [];
  for (let i = dB.length - 1; i >= 0; i--) {
    partials.push(a * Number(dB[i]));
  }

  const maxLen = Math.max(dA.length, dB.length, dR.length, ...partials.map(p => digits(p).length + (dB.length - 1 - partials.indexOf(p)))) + 1;

  const pad = (d: string[], len: number) => {
    const p = Array(len - d.length).fill("");
    return [...p, ...d];
  };

  const rowA = ["", ...pad(dA, maxLen - 1)];
  const rowB = ["×", ...pad(dB, maxLen - 1)];

  const partialRows = partials.map((p, i) => {
    const dP = digits(p);
    const shifted = [...dP, ...Array(i).fill("0")];
    return ["", ...pad(shifted, maxLen - 1)];
  });

  const rowR = ["", ...pad(dR, maxLen - 1)];

  return (
    <div className="inline-block my-2">
      <table className="border-collapse" style={{ fontFamily: "monospace" }}>
        <tbody>
          <Row cells={rowA} />
          <Row cells={rowB} />
          <SeparatorRow cols={maxLen} />
          {partialRows.map((row, i) => (
            <Row key={i} cells={row} />
          ))}
          {partials.length > 1 && <SeparatorRow cols={maxLen} />}
          <Row cells={rowR} bold />
        </tbody>
      </table>
    </div>
  );
}

/* ─── Division (Italian layout) ─── */
function DivisionGrid({ numbers }: { numbers: number[] }) {
  const [dividend, divisor] = numbers;
  const steps = useMemo(() => computeDivisionSteps(dividend, divisor), [dividend, divisor]);
  const dDividend = digits(dividend);
  const dDivisor = digits(divisor);
  const dQuotient = digits(steps.quotient);

  const leftCols = dDividend.length + 1; // extra space for minus signs
  const rightCols = Math.max(dDivisor.length, dQuotient.length) + 1;

  return (
    <div className="inline-block my-2">
      <table className="border-collapse" style={{ fontFamily: "monospace" }}>
        <tbody>
          {/* Header: dividend | divisor */}
          <tr>
            {Array.from({ length: leftCols }).map((_, c) => {
              const idx = c - (leftCols - dDividend.length);
              return (
                <Cell key={`h-${c}`} value={idx >= 0 && idx < dDividend.length ? dDividend[idx] : ""} borderRight={c === leftCols - 1} />
              );
            })}
            {Array.from({ length: rightCols }).map((_, c) => {
              const idx = c;
              return (
                <Cell key={`hd-${c}`} value={idx < dDivisor.length ? dDivisor[idx] : ""} />
              );
            })}
          </tr>
          {/* Separator under header */}
          <tr>
            {Array.from({ length: leftCols }).map((_, c) => (
              <td key={`sep-${c}`} style={{
                width: CELL, height: 4,
                borderRight: c === leftCols - 1 ? THICK : undefined,
              }} />
            ))}
            {Array.from({ length: rightCols }).map((_, c) => (
              <td key={`sepr-${c}`} style={{
                width: CELL, height: 4,
                borderTop: THICK,
              }} />
            ))}
          </tr>
          {/* Quotient row */}
          <tr>
            {Array.from({ length: leftCols }).map((_, c) => (
              <td key={`q-empty-${c}`} style={{
                width: CELL, height: CELL,
                borderRight: c === leftCols - 1 ? THICK : undefined,
              }} />
            ))}
            {Array.from({ length: rightCols }).map((_, c) => {
              const idx = c;
              return (
                <Cell key={`q-${c}`} value={idx < dQuotient.length ? dQuotient[idx] : ""} bold />
              );
            })}
          </tr>
          {/* Steps */}
          {steps.lines.map((line, li) => (
            <tr key={`step-${li}`}>
              {Array.from({ length: leftCols }).map((_, c) => {
                const idx = c - (leftCols - line.width);
                let value = "";
                if (idx >= 0 && idx < line.digits.length) {
                  value = line.digits[idx];
                }
                if (c === 0 && line.isMinus) value = "−";
                return (
                  <Cell
                    key={`s-${li}-${c}`}
                    value={value}
                    borderRight={c === leftCols - 1}
                    borderTop={line.isSeparator && c > 0}
                    muted={c === 0 && line.isMinus}
                  />
                );
              })}
              {Array.from({ length: rightCols }).map((_, c) => (
                <td key={`sr-${li}-${c}`} style={{ width: CELL, height: CELL }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Shared components ─── */
function Cell({ value, bold, borderRight, borderTop, muted }: {
  value: string;
  bold?: boolean;
  borderRight?: boolean;
  borderTop?: boolean;
  muted?: boolean;
}) {
  return (
    <td style={{
      width: CELL,
      height: CELL,
      border: BORDER,
      borderRight: borderRight ? THICK : BORDER,
      borderTop: borderTop ? THICK : BORDER,
      textAlign: "center",
      verticalAlign: "middle",
      fontSize: 18,
      fontWeight: bold ? 700 : 400,
      fontFamily: "monospace",
      color: muted ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
      background: value === "" ? "hsl(var(--muted) / 0.3)" : "hsl(var(--card))",
    }}>
      {value}
    </td>
  );
}

function Row({ cells, bold }: { cells: string[]; bold?: boolean }) {
  return (
    <tr>
      {cells.map((v, i) => (
        <Cell key={i} value={v} bold={bold} />
      ))}
    </tr>
  );
}

function SeparatorRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{
          width: CELL,
          height: 4,
          borderLeft: BORDER,
          borderRight: BORDER,
          borderTop: THICK,
          borderBottom: THICK,
          background: "hsl(var(--foreground))",
        }} />
      ))}
    </tr>
  );
}

/* ─── Division computation ─── */
interface DivStep {
  digits: string[];
  width: number;
  isMinus: boolean;
  isSeparator: boolean;
}

function computeDivisionSteps(dividend: number, divisor: number) {
  const dStr = String(dividend);
  const lines: DivStep[] = [];
  let carry = 0;
  let quotientStr = "";
  const totalWidth = dStr.length;

  for (let i = 0; i < dStr.length; i++) {
    carry = carry * 10 + Number(dStr[i]);
    const q = Math.floor(carry / divisor);
    quotientStr += String(q);
    const product = q * divisor;

    if (q > 0 || lines.length > 0) {
      // Show subtraction line
      const pStr = String(product);
      lines.push({
        digits: pStr.split(""),
        width: Math.max(String(carry).length, pStr.length),
        isMinus: true,
        isSeparator: false,
      });
      // Separator
      lines.push({
        digits: [],
        width: Math.max(String(carry).length, pStr.length),
        isMinus: false,
        isSeparator: true,
      });
    }

    carry = carry - product;

    // Show remainder (or next carry)
    if (i < dStr.length - 1 || carry > 0 || lines.length > 0) {
      const nextCarry = i < dStr.length - 1 ? carry * 10 + Number(dStr[i + 1]) : carry;
      if (i < dStr.length - 1) {
        lines.push({
          digits: String(nextCarry).split(""),
          width: String(nextCarry).length,
          isMinus: false,
          isSeparator: false,
        });
      } else {
        lines.push({
          digits: String(carry).split(""),
          width: Math.max(1, String(carry).length),
          isMinus: false,
          isSeparator: false,
        });
      }
    }
  }

  // Remove leading zeros from quotient
  quotientStr = quotientStr.replace(/^0+/, "") || "0";

  return { quotient: Number(quotientStr), lines };
}

/* ─── Main export ─── */
export function ColumnOperation({ type, numbers }: ColumnOperationProps) {
  if (numbers.length < 2) return null;

  switch (type) {
    case "addition":
    case "subtraction":
      return <AddSubGrid numbers={numbers} type={type} />;
    case "multiplication":
      return <MultiplicationGrid numbers={numbers} />;
    case "division":
      return <DivisionGrid numbers={numbers} />;
    default:
      return null;
  }
}

export default ColumnOperation;
