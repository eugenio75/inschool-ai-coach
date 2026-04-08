import React from "react";
import { HandwrittenDivision } from "./handwritten/HandwrittenDivision";
import { HandwrittenAddSub } from "./handwritten/HandwrittenAddSub";
import { HandwrittenMultiplication } from "./handwritten/HandwrittenMultiplication";
import { WritingPen } from "./handwritten/WritingPen";
import type { AgeTier, CellHighlight } from "./handwritten/utils";

export interface ColumnOperationProps {
  type: "multiplication" | "division" | "addition" | "subtraction";
  numbers: number[];
  tier?: AgeTier;
  /** If true, only show filled cells; remaining are gray placeholders */
  partial?: boolean;
  /** How many result cells are filled (left to right) */
  filledCells?: number;
  /** Sub-step within the current step (division: 0=ask, 1=quotient, 2=product, 3=remainder) */
  subStep?: number;
  /** Cells to highlight with specific colors */
  highlights?: CellHighlight[];
}

export function ColumnOperation({
  type,
  numbers,
  tier = "upper-elementary",
  partial = false,
  filledCells,
  subStep,
  highlights,
}: ColumnOperationProps) {
  if (numbers.length < 2) return null;
  const [a, b] = numbers;

  return (
    <div className="my-3 flex items-start gap-2">
      <WritingPen writing={false} />
      <div>
        {type === "addition" || type === "subtraction" ? (
          <HandwrittenAddSub type={type} a={a} b={b} tier={tier} partial={partial} filledCells={filledCells} highlights={highlights} />
        ) : type === "multiplication" ? (
          <HandwrittenMultiplication a={a} b={b} tier={tier} partial={partial} filledCells={filledCells} highlights={highlights} />
        ) : type === "division" ? (
          <HandwrittenDivision dividend={a} divisor={b} tier={tier} partial={partial} filledCells={filledCells} subStep={subStep} highlights={highlights} />
        ) : null}
      </div>
    </div>
  );
}

export default ColumnOperation;
