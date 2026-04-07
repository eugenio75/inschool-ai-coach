import React from "react";

/**
 * Animated pen icon that oscillates while the professor is "writing".
 * Shows a blinking cursor when waiting for student input.
 */
export function WritingPen({ writing }: { writing: boolean }) {
  if (!writing) {
    // Blinking cursor
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#7F77DD] font-['Caveat'] ml-1">
        <span className="w-0.5 h-4 bg-[#7F77DD] animate-pulse rounded-full" />
      </span>
    );
  }

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="inline-block pen-writing"
      style={{ verticalAlign: "text-bottom" }}
    >
      <path
        d="M3 21l1.65-3.8a.85.85 0 0 1 .25-.34l12.22-12.22a1.5 1.5 0 0 1 2.12 0l1.12 1.12a1.5 1.5 0 0 1 0 2.12L8.14 20.1a.85.85 0 0 1-.34.25L4 22l-1-1z"
        fill="none"
        stroke="#2C2C2A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 6l4 4" fill="none" stroke="#2C2C2A" strokeWidth="1.5" />
    </svg>
  );
}
