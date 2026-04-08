import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MathText } from "@/components/shared/MathText";

interface Props {
  content: string;
  /** ms per character for typewriter */
  charDelay?: number;
  /** ms pause between paragraphs/blocks */
  blockPause?: number;
  /** Called when all content has been revealed */
  onComplete?: () => void;
  /** Exercise step for incremental SVG rendering */
  exerciseStep?: number;
}

/**
 * Progressively reveals coach message content one block at a time.
 * Each paragraph/line appears with a typewriter effect.
 * [COLONNA:] tags appear after the preceding text finishes.
 */
export function ProgressiveMessage({
  content,
  charDelay = 35,
  blockPause = 800,
  onComplete,
  exerciseStep,
}: Props) {
  const blocks = useMemo(() => splitIntoBlocks(content), [content]);
  const [visibleBlocks, setVisibleBlocks] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  // Reset on content change
  useEffect(() => {
    setVisibleBlocks(0);
    setTypedChars(0);
    completedRef.current = false;
  }, [content]);

  // Reveal blocks one by one
  useEffect(() => {
    if (visibleBlocks >= blocks.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    const currentBlock = blocks[visibleBlocks];

    if (currentBlock.type === "colonna") {
      // Show column operation immediately, pause, then move to next
      timerRef.current = setTimeout(() => {
        setVisibleBlocks((v) => v + 1);
        setTypedChars(0);
      }, blockPause + 1500); // extra time for SVG animation
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    // Text block: typewriter effect
    const totalChars = currentBlock.text.length;
    if (typedChars >= totalChars) {
      // Block finished, pause then show next
      timerRef.current = setTimeout(() => {
        setVisibleBlocks((v) => v + 1);
        setTypedChars(0);
      }, blockPause);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    // Type next character
    charTimerRef.current = setTimeout(() => {
      setTypedChars((c) => c + 1);
    }, charDelay);

    return () => { if (charTimerRef.current) clearTimeout(charTimerRef.current); };
  }, [visibleBlocks, typedChars, blocks, charDelay, blockPause, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (charTimerRef.current) clearTimeout(charTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {blocks.slice(0, visibleBlocks + 1).map((block, i) => {
          const isCurrentBlock = i === visibleBlocks;
          const isPastBlock = i < visibleBlocks;

          if (block.type === "colonna") {
            return (
              <motion.div
                key={`col-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <MathText exerciseStep={exerciseStep}>{block.raw}</MathText>
              </motion.div>
            );
          }

          // Text block
          const displayText = isPastBlock
            ? block.text
            : block.text.substring(0, typedChars);

          return (
            <motion.div
              key={`txt-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: isPastBlock ? 0.85 : 1,
                y: 0,
                fontSize: isPastBlock && visibleBlocks > i + 1 ? "0.95em" : "1em",
              }}
              transition={{ duration: 0.3 }}
            >
              <MathText exerciseStep={exerciseStep}>{displayText}</MathText>
              {isCurrentBlock && typedChars < block.text.length && (
                <span className="inline-block w-0.5 h-4 bg-foreground/60 ml-0.5 animate-pulse rounded-full" />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

interface TextBlock {
  type: "text";
  text: string;
  raw: string;
}

interface ColonnaBlock {
  type: "colonna";
  raw: string;
}

type Block = TextBlock | ColonnaBlock;

const COLONNA_RE = /\[COLONNA:\s*tipo\s*=\s*\w+\s*,\s*numeri\s*=\s*[\d,]+(?:\s*,\s*(?:parziale|celle_compilate|evidenzia)\s*=\s*[^\],]+)*\s*\]/gi;

function splitIntoBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    const match = COLONNA_RE.exec(remaining);
    COLONNA_RE.lastIndex = 0; // Reset regex

    if (!match) {
      // No more COLONNA tags — split remaining text by paragraphs
      const paragraphs = remaining.split(/\n{2,}/).filter((p) => p.trim());
      for (const p of paragraphs) {
        // Further split by single newlines for line-by-line reveal
        const lines = p.split(/\n/).filter((l) => l.trim());
        for (const line of lines) {
          blocks.push({ type: "text", text: line.trim(), raw: line.trim() });
        }
      }
      break;
    }

    // Text before the COLONNA tag
    const before = remaining.substring(0, match.index).trim();
    if (before) {
      const lines = before.split(/\n/).filter((l) => l.trim());
      for (const line of lines) {
        blocks.push({ type: "text", text: line.trim(), raw: line.trim() });
      }
    }

    // The COLONNA tag itself
    blocks.push({ type: "colonna", raw: match[0] });

    remaining = remaining.substring(match.index + match[0].length);
  }

  return blocks.length === 0
    ? [{ type: "text", text: content, raw: content }]
    : blocks;
}

export default ProgressiveMessage;
