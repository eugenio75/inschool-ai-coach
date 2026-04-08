import React from "react";
import { motion } from "framer-motion";
import { FS, jit, pathLength, type El, type AgeTier, getTierConfig, COLORS } from "./utils";

/**
 * Shared SVG renderer for all handwritten math operations.
 * Renders elements with stroke-draw and fade-in animations.
 * Placeholder elements render as dashed underscores until their step arrives.
 * Hidden elements render as gray underscores (for partial/interactive mode).
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

        // Hidden cell — show gray underscore placeholder
        if (el.isHidden) {
          const fontSize = el.fontSize || FS;
          return (
            <motion.text
              key={el.id}
              x={el.x + jit(el.seed, 0.5)}
              y={el.y}
              fill={COLORS.empty}
              fontSize={fontSize}
              fontFamily="'Patrick Hand', cursive"
              textAnchor="middle"
              dominantBaseline="auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              _
            </motion.text>
          );
        }

        // Placeholder: show dashed underscore, then reveal real digit
        if (el.isPlaceholder) {
          const fontSize = el.fontSize || FS;
          const fillColor = el.highlightColor || (el.isResult ? COLORS.result : el.color);
          return (
            <React.Fragment key={el.id}>
              {/* Dashed placeholder visible immediately */}
              <motion.text
                x={el.x + jit(el.seed, 0.5)}
                y={el.y}
                fill={el.color}
                fontSize={fontSize}
                fontFamily="'Patrick Hand', cursive"
                textAnchor="middle"
                dominantBaseline="auto"
                initial={{ opacity: 0.6 }}
                animate={{ opacity: delay > 0 ? [0.6, 0.6, 0] : 0 }}
                transition={{
                  opacity: { delay: 0.3, duration: delay > 0 ? delay : 0.01, times: [0, 0.95, 1] },
                }}
              >
                _
              </motion.text>
              {/* Real digit fades in at its delay */}
              <motion.text
                x={el.x + jit(el.seed, 0.8)}
                y={el.y + jit(el.seed + 3, 0.5)}
                fill={fillColor}
                fontSize={fontSize}
                fontFamily="'Patrick Hand', cursive"
                textAnchor="middle"
                dominantBaseline="auto"
                fontWeight={700}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: 1,
                  scale: el.isResult ? [1, 1.2, 1] : 1,
                }}
                transition={{
                  opacity: { delay, duration: 0.4 * tm },
                  scale: el.isResult
                    ? { delay: delay + 0.1 * tm, duration: 0.5, times: [0, 0.5, 1] }
                    : { delay, duration: 0.3 * tm },
                }}
              >
                {el.text}
              </motion.text>
            </React.Fragment>
          );
        }

        // Normal text element
        const fontSize = el.fontSize || FS;
        const fillColor = el.highlightColor || el.color;
        return (
          <motion.text
            key={el.id}
            x={el.x + jit(el.seed, 0.8)}
            y={el.y + jit(el.seed + 3, 0.5)}
            fill={fillColor}
            fontSize={fontSize}
            fontFamily="'Patrick Hand', cursive"
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
