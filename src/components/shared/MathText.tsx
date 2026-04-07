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
  const hasBlockContent = useMemo(
    () => /```|(?:^|\n)\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(children || ""),
    [children]
  );

  if (hasBlockContent) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="math-text math-text-block"
      />
    );
  }

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

function renderCodeBlocks(text: string): string {
  // Replace ```...``` code blocks with styled <pre><code> blocks
  return text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="math-code-block"><code>${escapeHtml(code.trimEnd())}</code></pre>`;
  });
}

function renderInlineCode(text: string): string {
  // Replace `...` inline code with styled <code> blocks
  return text.replace(/`([^`\n]+)`/g, (_match, code) => {
    return `<code class="math-inline-code">${escapeHtml(code)}</code>`;
  });
}

function renderMathInText(text: string): string {
  // First, extract and protect code blocks from LaTeX processing
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

  // Process display math first ($$...$$), then inline math ($...$)
  // Also handle \(...\) and \[...\] notation
  const parts: string[] = [];
  let remaining = processed;

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

  let result = parts.join("");

  // Restore code blocks and render them
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
