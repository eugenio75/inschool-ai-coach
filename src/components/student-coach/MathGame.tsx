import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensors,
  useSensor,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

/* ─── Types ─── */
export type MathOperation = "divisione" | "moltiplicazione" | "addizione" | "sottrazione";
interface MathGameProps {
  operation: MathOperation;
  a: number;
  b: number;
  onAnswer: (result: number) => void;
  onClose: () => void;
}

/* ─── Emoji sets ─── */
const EMOJI_SETS = ["🍬", "🍎", "⭐", "⚽", "🍕", "📚", "🎈", "🍪"];
function pickEmoji() {
  return EMOJI_SETS[Math.floor(Math.random() * EMOJI_SETS.length)];
}

/* ─── Sounds via Web Audio API ─── */
function playDropSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch {}
}
function playCorrectSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [440, 550, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  } catch {}
}
function fireConfetti() {
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
}

/* ─── DraggableItem ─── */
function DraggableItem({ id, emoji, isDragging }: { id: string; emoji: string; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
        opacity: isDragging ? 0.3 : 1,
        touchAction: "none",
        cursor: "grab",
      }}
      className="w-12 h-12 rounded-xl border-2 border-border bg-background flex items-center justify-center text-2xl select-none"
    >
      {emoji}
    </div>
  );
}

/* ─── DroppableBucket ─── */
function DroppableBucket({ id, items, emoji, label }: { id: string; items: string[]; emoji: string; label: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 min-w-[80px] min-h-[100px] transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-dashed border-muted-foreground/40 bg-muted/20"
      }`}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 justify-center">
        {items.map((itemId) => (
          <span key={itemId} className="text-xl">{emoji}</span>
        ))}
      </div>
      <span className="text-lg font-bold text-primary mt-auto">{items.length}</span>
    </div>
  );
}

/* ─── MultiplicationGrid ─── */
function MultiplicationGrid({ rows, cols, emoji, onComplete }: {
  rows: number; cols: number; emoji: string; onComplete: (total: number) => void;
}) {
  const [filled, setFilled] = useState(() =>
    Array.from({ length: rows }, () => Array(cols).fill(false))
  );
  const total = filled.flat().filter(Boolean).length;
  const allFilled = total === rows * cols;

  useEffect(() => {
    if (allFilled) {
      playCorrectSound(); fireConfetti();
      setTimeout(() => onComplete(rows * cols), 800);
    }
  }, [allFilled, rows, cols, onComplete]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground text-center">
        Clicca per riempire {rows} righe da {cols} — Totale: {total}
      </p>
      <div className="flex flex-col gap-1">
        {filled.map((row, r) => (
          <div key={r} className="flex gap-1 justify-center">
            {row.map((on, c) => (
              <button
                key={c}
                onClick={() => {
                  if (on) return;
                  playDropSound();
                  setFilled(prev => {
                    const next = prev.map(row => [...row]);
                    next[r][c] = true;
                    return next;
                  });
                }}
                className={`w-11 h-11 rounded-xl border-2 text-2xl flex items-center justify-center transition-all ${
                  on ? "bg-primary/10 border-primary" : "bg-muted/30 border-dashed border-muted-foreground/30 hover:border-primary/50"
                }`}
              >
                {on ? emoji : ""}
              </button>
            ))}
          </div>
        ))}
      </div>
      {allFilled && (
        <p className="text-center font-bold text-primary">{rows} × {cols} = {rows * cols} ✅</p>
      )}
    </div>
  );
}

/* ─── AdditionGame ─── */
function AdditionGame({ a, b, emoji, onComplete }: { a: number; b: number; emoji: string; onComplete: (total: number) => void }) {
  const [merged, setMerged] = useState(false);
  const handleMerge = () => {
    if (merged) return;
    setMerged(true); playCorrectSound(); fireConfetti();
    setTimeout(() => onComplete(a + b), 800);
  };
  return (
    <div className="flex flex-col gap-3 items-center">
      <p className="text-sm text-muted-foreground">Unisci i due gruppi!</p>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap gap-1 justify-center max-w-[120px]">
            {Array.from({ length: a }, (_, i) => <span key={i} className="text-2xl">{emoji}</span>)}
          </div>
          <span className="font-bold">{a}</span>
        </div>
        <span className="text-2xl font-bold text-primary">+</span>
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap gap-1 justify-center max-w-[120px]">
            {Array.from({ length: b }, (_, i) => <span key={i} className="text-2xl">{emoji}</span>)}
          </div>
          <span className="font-bold">{b}</span>
        </div>
      </div>
      {!merged ? (
        <button onClick={handleMerge} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">
          Unisci i gruppi! 🤝
        </button>
      ) : (
        <p className="text-center font-bold text-primary text-lg">{a} + {b} = {a + b} ✅</p>
      )}
    </div>
  );
}

/* ─── SubtractionGame ─── */
function SubtractionGame({ a, b, emoji, onComplete }: { a: number; b: number; emoji: string; onComplete: (total: number) => void }) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const done = removed.size === b;

  useEffect(() => {
    if (done) {
      playCorrectSound(); fireConfetti();
      setTimeout(() => onComplete(a - b), 800);
    }
  }, [done, a, b, onComplete]);

  return (
    <div className="flex flex-col gap-2 items-center">
      <p className="text-sm text-muted-foreground">Tocca {b} oggetti per rimuoverli! Rimasti: {a - removed.size}</p>
      <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
        {Array.from({ length: a }, (_, i) => (
          <motion.button
            key={i}
            onClick={() => {
              if (removed.has(i) || done) return;
              playDropSound();
              setRemoved(prev => new Set(prev).add(i));
            }}
            animate={{ scale: removed.has(i) ? 0 : 1, opacity: removed.has(i) ? 0 : 1 }}
            className="w-11 h-11 rounded-xl border border-border bg-background text-2xl flex items-center justify-center"
          >
            {emoji}
          </motion.button>
        ))}
      </div>
      {done && <p className="font-bold text-primary">{a} - {b} = {a - b} ✅</p>}
    </div>
  );
}

/* ═══════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════ */
export function MathGame({ operation, a, b, onAnswer, onClose }: MathGameProps) {
  const emoji = useMemo(pickEmoji, []);
  const [activeId, setActiveId] = useState<string | null>(null);

  /* Division state */
  const [buckets, setBuckets] = useState<Record<string, string[]>>(() => {
    const bk: Record<string, string[]> = {};
    for (let i = 0; i < b; i++) bk[`bucket-${i}`] = [];
    return bk;
  });
  const [availableItems, setAvailableItems] = useState(() =>
    Array.from({ length: a }, (_, i) => `item-${i}`)
  );
  const [divisionDone, setDivisionDone] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  useEffect(() => {
    if (operation !== "divisione" || divisionDone) return;
    if (availableItems.length === 0 && a > 0) {
      setDivisionDone(true);
      playCorrectSound(); fireConfetti();
      setTimeout(() => onAnswer(Math.floor(a / b)), 800);
    }
  }, [availableItems, operation, divisionDone, a, b, onAnswer]);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !buckets[over.id as string]) return;
    playDropSound();
    setAvailableItems(prev => prev.filter(id => id !== active.id));
    setBuckets(prev => ({ ...prev, [over.id as string]: [...prev[over.id as string], active.id as string] }));
  };

  const label = { divisione: `${a} ÷ ${b}`, moltiplicazione: `${a} × ${b}`, addizione: `${a} + ${b}`, sottrazione: `${a} - ${b}` }[operation];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="rounded-2xl border border-border bg-background shadow-lg p-4 mx-2 mb-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">🎮 Gioco: {label}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* Division */}
        {operation === "divisione" && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground mb-2 text-center">
                  Trascina le {emoji} nei cestini ({availableItems.length} rimaste)
                </p>
                <div className="flex flex-wrap gap-2 justify-center min-h-[52px]">
                  {availableItems.map(id => (
                    <DraggableItem key={id} id={id} emoji={emoji} isDragging={activeId === id} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {Object.entries(buckets).map(([bucketId, items], idx) => (
                  <DroppableBucket key={bucketId} id={bucketId} items={items} emoji={emoji} label={`Gruppo ${idx + 1}`} />
                ))}
              </div>
              {divisionDone && (
                <p className="text-center font-bold text-primary">
                  {Math.floor(a / b)} {emoji} per gruppo! ✅
                </p>
              )}
            </div>
            <DragOverlay>
              {activeId ? <span className="text-3xl">{emoji}</span> : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Multiplication */}
        {operation === "moltiplicazione" && (
          <MultiplicationGrid rows={a} cols={b} emoji={emoji} onComplete={onAnswer} />
        )}

        {/* Addition */}
        {operation === "addizione" && (
          <AdditionGame a={a} b={b} emoji={emoji} onComplete={onAnswer} />
        )}

        {/* Subtraction */}
        {operation === "sottrazione" && (
          <SubtractionGame a={a} b={b} emoji={emoji} onComplete={onAnswer} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
