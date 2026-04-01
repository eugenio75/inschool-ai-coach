import { useMemo } from "react";

export type CoachAvatarMood = "default" | "thinking" | "correct" | "proud" | "encouraging";

interface CoachAvatarProps {
  mood?: CoachAvatarMood;
  size?: number;
}

// Unique ID generator for SVG filters
let _idCounter = 0;
function uid() { return `ca-${++_idCounter}`; }

export function CoachAvatar({ mood = "default", size = 120 }: CoachAvatarProps) {
  const s = size;
  const half = s / 2;
  const scale = s / 120; // base design is 120px

  const ids = useMemo(() => ({ glow: uid(), blur: uid() }), []);

  // Mood-specific configs
  const cfg = useMemo(() => {
    switch (mood) {
      case "thinking":
        return {
          browAngleL: -8, browAngleR: 8, browOpacity: 0.8, browLiftY: 0,
          eyeW: 23, eyeH: 23, irisGradient: ["#64B5F6", "#0D47A1"],
          mouthType: "dots" as const,
          mouthW: 30, mouthH: 12, mouthBorder: 2, mouthGlow: 0.6,
          glowDuration: 7, glowDimmer: 0.65, floatDuration: 8, floatPx: 4,
          orbitA: 14, orbitB: 20, blinkInterval: 9, eyeMoveInterval: 13,
          sparkleExtra: false, eyeCrescent: false,
          pupilDriftUp: true,
        };
      case "correct":
        return {
          browAngleL: -12, browAngleR: 12, browOpacity: 1, browLiftY: -10,
          eyeW: 25, eyeH: 25, irisGradient: ["#81D4FA", "#0277BD"],
          mouthType: "arc" as const,
          mouthW: 46, mouthH: 20, mouthBorder: 3, mouthGlow: 1,
          glowDuration: 3, glowDimmer: 1, floatDuration: 6, floatPx: 4,
          orbitA: 8, orbitB: 12, blinkInterval: 9, eyeMoveInterval: 11,
          sparkleExtra: true, eyeCrescent: false,
          pupilDriftUp: false,
        };
      case "proud":
        return {
          browAngleL: -7, browAngleR: 7, browOpacity: 1, browLiftY: 0,
          eyeW: 23, eyeH: 12, irisGradient: ["#64B5F6", "#0D47A1"],
          mouthType: "arc" as const,
          mouthW: 44, mouthH: 20, mouthBorder: 2, mouthGlow: 0.8,
          glowDuration: 5, glowDimmer: 0.85, floatDuration: 6, floatPx: 4,
          orbitA: 14, orbitB: 20, blinkInterval: 9, eyeMoveInterval: 11,
          sparkleExtra: false, eyeCrescent: true,
          pupilDriftUp: false,
        };
      case "encouraging":
        return {
          browAngleL: 11, browAngleR: -11, browOpacity: 0.65, browLiftY: 0,
          eyeW: 22, eyeH: 22, irisGradient: ["#64B5F6", "#0D47A1"],
          mouthType: "arc" as const,
          mouthW: 22, mouthH: 9, mouthBorder: 2, mouthGlow: 0.5,
          glowDuration: 7, glowDimmer: 0.55, floatDuration: 7, floatPx: 4,
          orbitA: 14, orbitB: 20, blinkInterval: 12, eyeMoveInterval: 13,
          sparkleExtra: false, eyeCrescent: false,
          pupilDriftUp: false,
        };
      default: // "default" — happy face
        return {
          browAngleL: -10, browAngleR: 10, browOpacity: 1, browLiftY: -4,
          eyeW: 24, eyeH: 24, irisGradient: ["#64B5F6", "#0D47A1"],
          mouthType: "arc" as const,
          mouthW: 38, mouthH: 16, mouthBorder: 2.5, mouthGlow: 0.8,
          glowDuration: 5, glowDimmer: 0.9, floatDuration: 6, floatPx: 4,
          orbitA: 14, orbitB: 20, blinkInterval: 9, eyeMoveInterval: 11,
          sparkleExtra: false, eyeCrescent: false,
          pupilDriftUp: false,
        };
    }
  }, [mood]);

  const px = (v: number) => v * scale;

  // CSS keyframe names with mood to force re-render
  const animId = mood;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: s, height: s }}
    >
      {/* Inject keyframes */}
      <style>{`
        @keyframes ca-breathe-${animId} {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: ${cfg.glowDimmer * 0.75}; }
          50% { transform: translate(-50%, -50%) scale(1.08); opacity: ${cfg.glowDimmer}; }
        }
        @keyframes ca-float-${animId} {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-${cfg.floatPx}px); }
        }
        @keyframes ca-orbit-a {
          0% { transform: rotate(0deg) translateX(${px(32)}px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(${px(32)}px) rotate(-360deg); }
        }
        @keyframes ca-orbit-b {
          0% { transform: rotate(180deg) translateX(${px(28)}px) rotate(-180deg); }
          100% { transform: rotate(540deg) translateX(${px(28)}px) rotate(-540deg); }
        }
        @keyframes ca-blink {
          0%, ${100 - (100 / cfg.blinkInterval) * 0.15}%, ${100 - (100 / cfg.blinkInterval) * 0.05}%, 100% { transform: scaleY(1); }
          ${100 - (100 / cfg.blinkInterval) * 0.1}% { transform: scaleY(0.05); }
        }
        @keyframes ca-look {
          0%, 85%, 100% { transform: translate(-50%, -50%); }
          90% { transform: translate(calc(-50% + ${px(2)}px), ${cfg.pupilDriftUp ? `calc(-50% - ${px(2)}px)` : '-50%'}); }
          95% { transform: translate(calc(-50% - ${px(1.5)}px), -50%); }
        }
        @keyframes ca-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 0.9; transform: scale(1); }
        }
        @keyframes ca-dots-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40% { transform: translateY(-${px(4)}px); opacity: 1; }
        }
      `}</style>

      {/* Layer 1: Glow core */}
      <div
        style={{
          position: "absolute", left: "50%", top: "50%",
          width: px(80), height: px(80),
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,195,247,0.45) 0%, rgba(79,195,247,0) 70%)",
          filter: `blur(${px(12)}px)`,
          animation: `ca-breathe-${animId} ${cfg.glowDuration}s ease-in-out infinite`,
        }}
      />

      {/* Layer 2: Orbiting particles */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
        <div style={{
          position: "absolute",
          width: px(6), height: px(6), borderRadius: "50%",
          background: "rgba(79,195,247,0.45)",
          boxShadow: "0 0 4px rgba(79,195,247,0.4)",
          animation: `ca-orbit-a ${cfg.orbitA}s linear infinite`,
        }} />
        <div style={{
          position: "absolute",
          width: px(4), height: px(4), borderRadius: "50%",
          background: "rgba(255,213,79,0.5)",
          boxShadow: "0 0 4px rgba(255,213,79,0.3)",
          animation: `ca-orbit-b ${cfg.orbitB}s linear infinite`,
        }} />
      </div>

      {/* Layer 3: Glass base */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "radial-gradient(circle at 40% 35%, rgba(220,240,255,0.08) 0%, rgba(180,220,255,0.02) 60%, transparent 100%)",
        boxShadow: "inset 0 0 0 1.5px rgba(180,220,255,0.28), inset 0 0 60px rgba(100,160,220,0.04)",
      }} />

      {/* Layer 4: Fresnel rim / refraction */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "radial-gradient(circle at 50% 50%, transparent 55%, rgba(180,220,255,0.15) 75%, rgba(180,220,255,0.08) 100%)",
      }} />

      {/* Layer 5: Caustic rings */}
      <div style={{
        position: "absolute", inset: px(8), borderRadius: "50%",
        border: "1px solid rgba(79,195,247,0.08)",
      }} />
      <div style={{
        position: "absolute", inset: px(18), borderRadius: "50%",
        border: "1px solid rgba(79,195,247,0.05)",
      }} />

      {/* Layer 6: Entity (face) — floats gently */}
      <div style={{
        position: "absolute", inset: 0,
        animation: `ca-float-${animId} ${cfg.floatDuration}s ease-in-out infinite`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Inner sparkle particles */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            position: "absolute",
            width: px(i % 2 === 0 ? 3 : 4), height: px(i % 2 === 0 ? 3 : 4),
            borderRadius: "50%",
            background: "rgba(79,195,247,0.7)",
            boxShadow: "0 0 3px rgba(79,195,247,0.5)",
            top: `${30 + i * 12}%`, left: `${25 + i * 15}%`,
            animation: `ca-sparkle 4s ease-in-out ${i * 1}s infinite`,
          }} />
        ))}
        {cfg.sparkleExtra && [4, 5].map(i => (
          <div key={i} style={{
            position: "absolute",
            width: px(3), height: px(3),
            borderRadius: "50%",
            background: "rgba(79,195,247,0.6)",
            top: `${20 + i * 10}%`, left: `${30 + i * 8}%`,
            animation: `ca-sparkle 3s ease-in-out ${i * 0.7}s infinite`,
          }} />
        ))}

        {/* Face container */}
        <div style={{ position: "relative", width: px(70), height: px(50) }}>
          {/* Eyebrows */}
          <div style={{
            position: "absolute", top: px(2 + cfg.browLiftY * scale), left: px(10),
            width: px(18), height: px(4), borderRadius: px(2),
            background: "rgba(144,202,249,0.95)",
            boxShadow: "0 0 4px rgba(79,195,247,0.5)",
            transform: `rotate(${cfg.browAngleL}deg)`,
            opacity: cfg.browOpacity,
            transition: "all 0.4s ease",
          }} />
          <div style={{
            position: "absolute", top: px(2 + cfg.browLiftY * scale), right: px(10),
            width: px(18), height: px(4), borderRadius: px(2),
            background: "rgba(144,202,249,0.95)",
            boxShadow: "0 0 4px rgba(79,195,247,0.5)",
            transform: `rotate(${cfg.browAngleR}deg)`,
            opacity: cfg.browOpacity,
            transition: "all 0.4s ease",
          }} />

          {/* Eyes */}
          <div style={{
            position: "absolute", top: px(12), left: px(8),
            display: "flex", gap: px(14), alignItems: "center",
          }}>
            {[0, 1].map(eye => (
              <div key={eye} style={{
                width: px(cfg.eyeW), height: px(cfg.eyeH),
                borderRadius: cfg.eyeCrescent
                  ? "50% 50% 50% 50% / 26% 26% 74% 74%"
                  : "50%",
                background: "#fff",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 6px rgba(79,195,247,0.2)",
                animation: `ca-blink ${cfg.blinkInterval}s ease-in-out infinite`,
                transition: "all 0.4s ease",
              }}>
                {/* Iris */}
                {!cfg.eyeCrescent && (
                  <div style={{
                    position: "absolute",
                    width: px(cfg.eyeW * 0.65), height: px(cfg.eyeH * 0.65),
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${cfg.irisGradient[0]}, ${cfg.irisGradient[1]})`,
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    animation: `ca-look ${cfg.eyeMoveInterval}s ease-in-out infinite`,
                  }}>
                    {/* Pupil */}
                    <div style={{
                      position: "absolute",
                      width: px(cfg.eyeW * 0.3), height: px(cfg.eyeH * 0.3),
                      borderRadius: "50%",
                      background: "#0D47A1",
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                    }}>
                      {/* Inner cyan glow dot */}
                      <div style={{
                        position: "absolute",
                        width: px(2), height: px(2),
                        borderRadius: "50%",
                        background: "rgba(79,195,247,0.8)",
                        top: "35%", left: "35%",
                      }} />
                    </div>
                  </div>
                )}
                {/* Shine dots */}
                <div style={{
                  position: "absolute",
                  width: px(5), height: px(4),
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.96)",
                  top: px(2), left: px(3),
                }} />
                <div style={{
                  position: "absolute",
                  width: px(2.5), height: px(2),
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.7)",
                  bottom: px(3), right: px(3),
                }} />
              </div>
            ))}
          </div>

          {/* Mouth */}
          <div style={{
            position: "absolute",
            bottom: px(2),
            left: "50%",
            transform: "translateX(-50%)",
          }}>
            {cfg.mouthType === "dots" ? (
              <div style={{ display: "flex", gap: px(4), alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: px(6), height: px(6),
                    borderRadius: "50%",
                    background: "rgba(79,195,247,0.9)",
                    boxShadow: "0 0 4px rgba(79,195,247,0.5)",
                    animation: `ca-dots-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            ) : (
              <div style={{
                width: px(cfg.mouthW),
                height: px(cfg.mouthH),
                borderBottom: `${px(cfg.mouthBorder)}px solid rgba(79,195,247,0.95)`,
                borderRadius: `0 0 ${px(cfg.mouthW / 2)}px ${px(cfg.mouthW / 2)}px`,
                boxShadow: `0 ${px(2)}px ${px(6)}px rgba(79,195,247,${cfg.mouthGlow * 0.3})`,
                transition: "all 0.4s ease",
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Layer 7: Specular highlights */}
      <div style={{
        position: "absolute",
        top: px(10), left: px(16),
        width: px(46 * (s / 120)), height: px(30 * (s / 120)),
        borderRadius: "50%",
        background: "rgba(255,255,255,0.96)",
        filter: `blur(${px(8)}px)`,
        opacity: 0.35,
      }} />
      <div style={{
        position: "absolute",
        top: px(14), left: px(30),
        width: px(18 * (s / 120)), height: px(12 * (s / 120)),
        borderRadius: "50%",
        background: "rgba(255,255,255,0.8)",
        filter: `blur(${px(4)}px)`,
        opacity: 0.25,
      }} />
      <div style={{
        position: "absolute",
        bottom: px(18), right: px(18),
        width: px(14 * (s / 120)), height: px(10 * (s / 120)),
        borderRadius: "50%",
        background: "rgba(255,255,255,0.5)",
        filter: `blur(${px(3)}px)`,
        opacity: 0.2,
      }} />

      {/* Layer 8: Rim light (bottom-right) */}
      <div style={{
        position: "absolute",
        bottom: px(6), right: px(8),
        width: px(30), height: px(20),
        borderRadius: "50%",
        background: "rgba(79,195,247,0.1)",
        filter: `blur(${px(8)}px)`,
      }} />
    </div>
  );
}
