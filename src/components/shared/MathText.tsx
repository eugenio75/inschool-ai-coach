import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that may contain LaTeX math expressions.
 * Supports both inline math ($...$) and display math ($$...$$).
 * Non-math text is rendered as-is.
 */
export function MathText({ children }: { children: string }) {
  const html = useMemo(() => renderMathInText(children || ""), [children]);
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className="math-text"
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMathInText(text: string): string {
  // Process display math first ($$...$$), then inline math ($...$)
  // Also handle \(...\) and \[...\] notation
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Try display math $$...$$ 
    const ddMatch = remaining.match(/\$\$([\s\S]+?)\$\$/);
    // Try \[...\]
    const bracketDisplay = remaining.match(/\\\[([\s\S]+?)\\\]/);
    // Try inline math $...$
    const inlineMatch = remaining.match(/\$([^\$\n]+?)\$/);
    // Try \(...\)
    const bracketInline = remaining.match(/\\\(([\s\S]+?)\\\)/);

    // Find earliest match
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

    // Pick the one that appears first
    candidates.sort((a, b) => a.idx - b.idx);
    const best = candidates[0];

    // Add text before the match
    if (best.idx > 0) {
      parts.push(escapeHtml(remaining.substring(0, best.idx)));
    }

    // Render LaTeX
    try {
      const rendered = katex.renderToString(best.latex.trim(), {
        throwOnError: false,
        displayMode: best.display,
        trust: true,
      });
      parts.push(rendered);
    } catch {
      // If rendering fails, show the original text
      parts.push(escapeHtml(remaining.substring(best.idx, best.idx + best.len)));
    }

    remaining = remaining.substring(best.idx + best.len);
  }

  return parts.join("");
}

export default MathText;
