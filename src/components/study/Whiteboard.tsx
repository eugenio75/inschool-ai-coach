import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhiteboardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (imageDataUrl: string) => void;
  loading?: boolean;
}

export function Whiteboard({ open, onClose, onSubmit, loading }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Setup canvas
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.fillStyle = "#1A1A1A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#F0F0F0";
    ctx.shadowColor = "rgba(255,255,255,0.25)";
    ctx.shadowBlur = 0.5;
    setHasContent(false);
  }, [open]);

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
    // Play chalk sound
    playChalkSound();
  }, [getPos]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasContent(true);
  }, [isDrawing, getPos]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1A1A1A";
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    setHasContent(false);
  }, []);

  const handleDone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSubmit(dataUrl);
  }, [onSubmit]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#111111]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <h3 className="text-white font-['Patrick_Hand'] text-lg">✏️ Lavagna</h3>
            <button onClick={onClose} className="text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 mx-3 mb-3 rounded-xl overflow-hidden" style={{ border: "8px solid #8B6914", borderRadius: "12px" }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0 pb-safe">
            <Button
              variant="ghost"
              onClick={clearCanvas}
              disabled={!hasContent || loading}
              className="text-white/70 hover:text-white hover:bg-white/10 gap-2"
            >
              <Trash2 className="w-4 h-4" /> 🗑️ Cancella
            </Button>
            <Button
              onClick={handleDone}
              disabled={!hasContent || loading}
              className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white gap-2 rounded-xl px-6"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Leggendo...</>
              ) : (
                <><Check className="w-4 h-4" /> Fatto! ✅</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Chalk sound using Web Audio API
function playChalkSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bufferSize = 4096;
    const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    noise.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    };
    noise.connect(gain);
    gain.connect(ctx.destination);
    setTimeout(() => {
      noise.disconnect();
      gain.disconnect();
    }, 150);
  } catch {}
}
