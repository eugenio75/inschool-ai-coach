import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { ColumnOperation, type ColumnOperationProps } from "./ColumnOperation";
import type { CellHighlight, HighlightColor } from "./handwritten/utils";

// Extended regex: supports optional parziale, celle_compilate, evidenzia
const COLONNA_RE = /\[COLONNA:\s*tipo\s*=\s*(\w+)\s*,\s*numeri\s*=\s*([\d,]+)(?:\s*,\s*parziale\s*=\s*(true|false))?(?:\s*,\s*celle_compilate\s*=\s*(\d+))?(?:\s*,\s*sotto_passo\s*=\s*(\d+))?(?:\s*,\s*evidenzia\s*=\s*([^\]]+))?\s*\]/gi;

const TIPO_MAP: Record<string, ColumnOperationProps["type"]> = {
  moltiplicazione: "multiplication",
  divisione: "division",
  addizione: "addition",
  sottrazione: "subtraction",
  multiplication: "multiplication",
  division: "division",
  addition: "addition",
  subtraction: "subtraction",
};

const COLOR_MAP: Record<string, HighlightColor> = {
  verde: "green", green: "green",
  arancione: "orange", orange: "orange",
  blu: "blue", blue: "blue",
};

function parseHighlights(raw: string): CellHighlight[] {
  // Format: "7,6:arancione" or "r0:verde,r1:blu"
  const highlights: CellHighlight[] = [];
  const parts = raw.split(",");
  for (const part of parts) {
    const [cellId, colorStr] = part.trim().split(":");
    if (cellId && colorStr) {
      const color = COLOR_MAP[colorStr.trim().toLowerCase()];
      if (color) highlights.push({ cellId: cellId.trim(), color });
    }
  }
  return highlights;
}

/**
 * Renders text that may contain LaTeX math expressions and [COLONNA:...] tags.
 */
export function MathText({ children, exerciseStep }: { children: string; exerciseStep?: number }) {
  const text = children || "";

  // Split text by COLONNA tags
  const segments = useMemo(() => splitByColonna(text), [text]);

  // Detect if the message text contains exercise questions (used as fallback)
  const isExerciseMessage = useMemo(() => {
    if (exerciseStep !== undefined) return exerciseStep >= 0;
    // Auto-detect: message has COLONNA + question pattern
    return /\[COLONNA:/i.test(text) && /\?\s*$/m.test(text);
  }, [text, exerciseStep]);

  const hasBlockContent = useMemo(
    () => /```|(?:^|\n)\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(text) || /\[COLONNA:/.test(text),
    [text]
  );

  if (segments.length === 1 && segments[0].type === "text") {
    const html = renderMathInText(segments[0].value);
    if (hasBlockContent) {
      return <div dangerouslySetInnerHTML={{ __html: html }} className="math-text math-text-block" />;
    }
    return <span dangerouslySetInnerHTML={{ __html: html }} className="math-text" />;
  }

  // Mixed content with COLONNA tags
  return (
    <div className="math-text math-text-block">
      {segments.map((seg, i) => {
        if (seg.type === "colonna") {
          // In exercise mode, force partial rendering
          const forcePartial = isExerciseMessage && !seg.partial;
          const effectiveStep = exerciseStep ?? 0;
          let effectiveFilledCells = seg.filledCells;
          let effectiveSubStep = seg.subStep;

          if (forcePartial || (seg.partial && exerciseStep !== undefined)) {
            // Map exerciseStep to (filledCells, subStep)
            // Division: 3 sub-steps per quotient digit (quotient, product, remainder)
            // Other ops: 1 step per result digit
            if (seg.opType === "division") {
              if (effectiveStep === 0) {
                effectiveFilledCells = 0;
                effectiveSubStep = 0;
              } else {
                const idx = effectiveStep - 1;
                effectiveFilledCells = Math.floor(idx / 3);
                effectiveSubStep = (idx % 3) + 1;
              }
            } else {
              effectiveFilledCells = effectiveStep;
              effectiveSubStep = undefined;
            }
          }

          return (
            <ColumnOperation
              key={i}
              type={seg.opType}
              numbers={seg.numbers}
              partial={forcePartial || seg.partial}
              filledCells={effectiveFilledCells}
              subStep={effectiveSubStep}
              highlights={seg.highlights}
            />
          );
        }
        const html = renderMathInText(seg.value);
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

interface TextSegment { type: "text"; value: string; }
interface ColonnaSegment {
  type: "colonna";
  opType: ColumnOperationProps["type"];
  numbers: number[];
  partial?: boolean;
  filledCells?: number;
  subStep?: number;
  highlights?: CellHighlight[];
}
type Segment = TextSegment | ColonnaSegment;

function splitByColonna(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const re = new RegExp(COLONNA_RE.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const tipo = TIPO_MAP[match[1].toLowerCase()];
    const nums = match[2].split(",").map(Number).filter(n => !isNaN(n));
    const partial = match[3] === "true";
    const filledCells = match[4] ? parseInt(match[4], 10) : undefined;
    const subStep = match[5] ? parseInt(match[5], 10) : undefined;
    const highlights = match[6] ? parseHighlights(match[6]) : undefined;

    if (tipo && nums.length >= 2) {
      segments.push({ type: "colonna", opType: tipo, numbers: nums, partial, filledCells, subStep, highlights });
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length === 0 ? [{ type: "text", value: text }] : segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCodeBlocks(text: string): string {
  return text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="math-code-block"><code>${escapeHtml(code.trimEnd())}</code></pre>`;
  });
}

function renderInlineCode(text: string): string {
  return text.replace(/`([^`\n]+)`/g, (_match, code) => {
    return `<code class="math-inline-code">${escapeHtml(code)}</code>`;
  });
}

function renderMathInText(text: string): string {
  const codeBlocks: string[] = [];
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`\n]+)`/g, (match) => {
    inlineCodes.push(match);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  const parts: string[] = [];
  let remaining = processed;

  while (remaining.length > 0) {
    const ddMatch = remaining.match(/\$\$([\s\S]+?)\$\$/);
    const bracketDisplay = remaining.match(/\\\[([\s\S]+?)\\\]/);
    const inlineMatch = remaining.match(/\$([^\$\n]+?)\$/);
    const bracketInline = remaining.match(/\\\(([\s\S]+?)\\\)/);

    const candidates = [
      ddMatch ? { idx: ddMatch.index!, len: ddMatch[0].length, latex: ddMatch[1], display: true } : null,
      bracketDisplay ? { idx: bracketDisplay.index!, len: bracketDisplay[0].length, latex: bracketDisplay[1], display: true } : null,
      inlineMatch ? { idx: inlineMatch.index!, len: inlineMatch[0].length, latex: inlineMatch[1], display: false } : null,
      bracketInline ? { idx: bracketInline.index!, len: bracketInline[0].length, latex: bracketInline[1], display: false } : null,
    ].filter(Boolean) as { idx: number; len: number; latex: string; display: boolean }[];

    if (candidates.length === 0) {
      parts.push(escapeHtml(remaining));
      break;
    }

    candidates.sort((a, b) => a.idx - b.idx);
    const best = candidates[0];

    if (best.idx > 0) {
      parts.push(escapeHtml(remaining.substring(0, best.idx)));
    }

    try {
      const rendered = katex.renderToString(best.latex.trim(), {
        throwOnError: false,
        displayMode: best.display,
        trust: true,
      });
      parts.push(rendered);
    } catch {
      parts.push(escapeHtml(remaining.substring(best.idx, best.idx + best.len)));
    }

    remaining = remaining.substring(best.idx + best.len);
  }

  let result = parts.join("");

  codeBlocks.forEach((block, i) => {
    const rendered = renderCodeBlocks(block);
    result = result.replace(`__CODE_BLOCK_${i}__`, rendered);
  });
  inlineCodes.forEach((code, i) => {
    const rendered = renderInlineCode(code);
    result = result.replace(`__INLINE_CODE_${i}__`, rendered);
  });

  return result;
}

export default MathText;
