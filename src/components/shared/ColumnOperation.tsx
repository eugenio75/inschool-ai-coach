import React from "react";
import { HandwrittenDivision } from "./handwritten/HandwrittenDivision";
import { HandwrittenAddSub } from "./handwritten/HandwrittenAddSub";
import { HandwrittenMultiplication } from "./handwritten/HandwrittenMultiplication";
import { WritingPen } from "./handwritten/WritingPen";
import type { AgeTier } from "./handwritten/utils";

export interface ColumnOperationProps {
  type: "multiplication" | "division" | "addition" | "subtraction";
  numbers: number[];
  tier?: AgeTier;
}

export function ColumnOperation({ type, numbers, tier = "upper-elementary" }: ColumnOperationProps) {
  if (numbers.length < 2) return null;
  const [a, b] = numbers;

  return (
    <div className="my-3 flex items-start gap-2">
      <WritingPen writing={false} />
      <div>
        {type === "addition" || type === "subtraction" ? (
          <HandwrittenAddSub type={type} a={a} b={b} tier={tier} />
        ) : type === "multiplication" ? (
          <HandwrittenMultiplication a={a} b={b} tier={tier} />
        ) : type === "division" ? (
          <HandwrittenDivision dividend={a} divisor={b} tier={tier} />
        ) : null}
      </div>
    </div>
  );
}

export default ColumnOperation;
