import React from "react";
import { HandwrittenDivision } from "./handwritten/HandwrittenDivision";
import { HandwrittenAddSub } from "./handwritten/HandwrittenAddSub";
import { HandwrittenMultiplication } from "./handwritten/HandwrittenMultiplication";

export interface ColumnOperationProps {
  type: "multiplication" | "division" | "addition" | "subtraction";
  numbers: number[];
}

export function ColumnOperation({ type, numbers }: ColumnOperationProps) {
  if (numbers.length < 2) return null;
  const [a, b] = numbers;

  switch (type) {
    case "addition":
    case "subtraction":
      return <HandwrittenAddSub type={type} a={a} b={b} />;
    case "multiplication":
      return <HandwrittenMultiplication a={a} b={b} />;
    case "division":
      return <HandwrittenDivision dividend={a} divisor={b} />;
    default:
      return null;
  }
}

export default ColumnOperation;
