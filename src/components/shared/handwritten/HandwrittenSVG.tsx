import React from "react";
import { motion } from "framer-motion";
import { FS, jit, pathLength, type El, type AgeTier, getTierConfig } from "./utils";

/**
 * Shared SVG renderer for all handwritten math operations.
 * Renders elements with stroke-draw and fade-in animations.
 */
interface Props {
  elements: El[];
  width: number;
  height: number;
  tier?: AgeTier;
}

export function HandwrittenSVG({ elements, width, height, tier = "upper-elementary" }: Props) {
  const cfg = getTierConfig(tier);
  const tm = cfg.timingMultiplier;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="max-w-full"
      style={{ overflow: "visible" }}
    >
      {elements.map((el) => {
        const delay = el.delay * tm;

        if (el.type === "path") {
          const len = pathLength(el.d || "");
          return (
            <motion.path
              key={el.id}
              d={el.d!}
              fill="none"
              stroke={el.color}
              strokeWidth={el.strokeWidth || 2}
              strokeLinecap="round"
              strokeDasharray={len}
              initial={{ strokeDashoffset: len, opacity: 0 }}
              animate={{ strokeDashoffset: 0, opacity: 1 }}
              transition={{
                strokeDashoffset: { delay, duration: 0.6 * tm, ease: "easeInOut" },
                opacity: { delay, duration: 0.1 },
              }}
            />
          );
        }

        // Text element
        const fontSize = el.fontSize || FS;
        return (
          <motion.text
            key={el.id}
            x={el.x + jit(el.seed, 0.8)}
            y={el.y + jit(el.seed + 3, 0.5)}
            fill={el.color}
            fontSize={fontSize}
            fontFamily="'Caveat', cursive"
            textAnchor="middle"
            dominantBaseline="auto"
            fontWeight={el.bold ? 700 : 400}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{
              opacity: 1,
              scale: el.isResult ? [1, 1.15, 1] : 1,
            }}
            transition={{
              opacity: { delay, duration: 0.4 * tm },
              scale: el.isResult
                ? { delay: delay + 0.3 * tm, duration: 0.5, times: [0, 0.5, 1] }
                : { delay, duration: 0.3 * tm },
            }}
          >
            {el.text}
          </motion.text>
        );
      })}
    </svg>
  );
}

export default HandwrittenSVG;
