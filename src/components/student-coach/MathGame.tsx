import { useState, useCallback, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensors,
  useSensor,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fireConfetti, playCorrectSound } from "@/lib/confetti";

/* ───────── types ───────── */
type MathOp = "divisione" | "moltiplicazione" | "addizione" | "sottrazione";

interface MathGameProps {
  operation: MathOp;
  a: number; // first operand
  b: number; // second operand
  onAnswer: (answer: number) => void;
  onClose: () => void;
}

/* ───────── emoji sets ───────── */
const EMOJI_SETS = ["🍬", "🍎", "⭐", "⚽"];
function pickEmoji() {
  return EMOJI_SETS[Math.floor(Math.random() * EMOJI_SETS.length)];
}

/* ───────── sounds ───────── */
function playDropSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

/* ───────── DraggableItem ───────── */
function DraggableItem({ id, emoji, isDragging }: { id: string; emoji: string; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="w-11 h-11 flex items-center justify-center text-2xl cursor-grab active:cursor-grabbing select-none rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-sm border border-border/40 transition-transform"
    >
      {emoji}
    </div>
  );
}

/* ───────── DroppableBucket ───────── */
function DroppableBucket({ id, items, emoji, label }: { id: string; items: string[]; emoji: string; label: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center gap-1 p-3 min-w-[80px] min-h-[100px] rounded-2xl border-2 border-dashed transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/30"
      }`}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 justify-center flex-1 items-center">
        {items.map((itemId) => (
          <motion.span
            key={itemId}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-2xl"
          >
            {emoji}
          </motion.span>
        ))}
      </div>
      <span className="text-sm font-bold text-foreground">{items.length}</span>
    </div>
  );
}

/* ───────── ClickableGrid (for multiplication) ───────── */
function ClickableGrid({ rows, cols, emoji, onComplete }: { rows: number; cols: number; emoji: string; onComplete: (total: number) => void }) {
  const [filled, setFilled] = useState<boolean[][]>(
    Array.from({ length: rows }, () => Array(cols).fill(false))
  );
  const total = filled.flat().filter(Boolean).length;
  const allFilled = total === rows * cols;

  useEffect(() => {
    if (allFilled) {
      playCorrectSound();
      fireConfetti();
      const timer = setTimeout(() => onComplete(rows * cols), 800);
      return () => clearTimeout(timer);
    }
  }, [allFilled, rows, cols, onComplete]);

  const handleClick = (r: number, c: number) => {
    if (filled[r][c]) return;
    playDropSound();
    setFilled((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = true;
      return next;
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-muted-foreground font-medium">
        Clicca per riempire {rows} righe da {cols} — Totale: <span className="font-bold text-foreground">{total}</span>
      </p>
      <div className="flex flex-col gap-1">
        {filled.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((on, c) => (
              <button
                key={c}
                onClick={() => handleClick(r, c)}
                className={`w-11 h-11 rounded-xl border-2 text-2xl flex items-center justify-center transition-all ${
                  on
                    ? "bg-primary/10 border-primary scale-100"
                    : "bg-muted/30 border-dashed border-muted-foreground/30 hover:border-primary/50"
                }`}
              >
                {on ? emoji : ""}
              </button>
            ))}
          </div>
        ))}
      </div>
      {allFilled && (
        <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg font-bold text-primary">
          {rows} × {cols} = {rows * cols} ✅
        </motion.p>
      )}
    </div>
  );
}

/* ───────── AdditionMerge ───────── */
function AdditionMerge({ a, b, emoji, onComplete }: { a: number; b: number; emoji: string; onComplete: (total: number) => void }) {
  const [merged, setMerged] = useState(false);

  const handleMerge = () => {
    if (merged) return;
    setMerged(true);
    playCorrectSound();
    fireConfetti();
    setTimeout(() => onComplete(a + b), 800);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground font-medium">
        Unisci i due gruppi: quanti sono in totale?
      </p>
      <div className="flex gap-4 items-end">
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap gap-1 justify-center max-w-[140px]">
            {Array.from({ length: a }, (_, i) => (
              <span key={`a-${i}`} className="text-2xl">{emoji}</span>
            ))}
          </div>
          <span className="text-sm font-bold">{a}</span>
        </div>
        <span className="text-2xl font-bold text-muted-foreground mb-4">+</span>
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap gap-1 justify-center max-w-[140px]">
            {Array.from({ length: b }, (_, i) => (
              <span key={`b-${i}`} className="text-2xl">{emoji}</span>
            ))}
          </div>
          <span className="text-sm font-bold">{b}</span>
        </div>
      </div>
      {!merged ? (
        <Button onClick={handleMerge} className="mt-2">
          Unisci i gruppi! 🤝
        </Button>
      ) : (
        <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg font-bold text-primary">
          {a} + {b} = {a + b} ✅
        </motion.p>
      )}
    </div>
  );
}

/* ───────── SubtractionGame ───────── */
function SubtractionGame({ a, b, emoji, onComplete }: { a: number; b: number; emoji: string; onComplete: (total: number) => void }) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const remaining = a - removed.size;
  const done = removed.size === b;

  useEffect(() => {
    if (done) {
      playCorrectSound();
      fireConfetti();
      const timer = setTimeout(() => onComplete(a - b), 800);
      return () => clearTimeout(timer);
    }
  }, [done, a, b, onComplete]);

  const handleRemove = (idx: number) => {
    if (removed.has(idx) || done) return;
    playDropSound();
    setRemoved((prev) => new Set(prev).add(idx));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground font-medium">
        Togli {b} oggetti! Toccali per rimuoverli. Rimasti: <span className="font-bold text-foreground">{remaining}</span>
      </p>
      <div className="flex flex-wrap gap-1 justify-center max-w-[280px]">
        {Array.from({ length: a }, (_, i) => (
          <motion.button
            key={i}
            onClick={() => handleRemove(i)}
            animate={{ scale: removed.has(i) ? 0 : 1, opacity: removed.has(i) ? 0 : 1 }}
            className="w-11 h-11 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-border/40 text-2xl flex items-center justify-center"
          >
            {emoji}
          </motion.button>
        ))}
      </div>
      {done && (
        <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg font-bold text-primary">
          {a} - {b} = {a - b} ✅
        </motion.p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */
export function MathGame({ operation, a, b, onAnswer, onClose }: MathGameProps) {
  const emoji = useMemo(pickEmoji, []);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Division state
  const totalItems = operation === "divisione" ? a : 0;
  const numBuckets = operation === "divisione" ? b : 0;
  const [buckets, setBuckets] = useState<Record<string, string[]>>(() => {
    const bk: Record<string, string[]> = {};
    for (let i = 0; i < numBuckets; i++) bk[`bucket-${i}`] = [];
    return bk;
  });
  const [availableItems, setAvailableItems] = useState<string[]>(() =>
    Array.from({ length: totalItems }, (_, i) => `item-${i}`)
  );
  const [divisionDone, setDivisionDone] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  // Check division completion
  useEffect(() => {
    if (operation !== "divisione" || divisionDone) return;
    if (availableItems.length === 0 && totalItems > 0) {
      setDivisionDone(true);
      playCorrectSound();
      fireConfetti();
      const perBucket = Math.floor(a / b);
      setTimeout(() => onAnswer(perBucket), 800);
    }
  }, [availableItems, operation, divisionDone, a, b, totalItems, onAnswer]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const itemId = active.id as string;
    const bucketId = over.id as string;
    if (!buckets[bucketId]) return;

    playDropSound();
    setAvailableItems((prev) => prev.filter((id) => id !== itemId));
    setBuckets((prev) => ({
      ...prev,
      [bucketId]: [...prev[bucketId], itemId],
    }));
  };

  const handleAnswer = useCallback((ans: number) => {
    onAnswer(ans);
  }, [onAnswer]);

  const operationLabel = {
    divisione: `${a} ÷ ${b}`,
    moltiplicazione: `${a} × ${b}`,
    addizione: `${a} + ${b}`,
    sottrazione: `${a} - ${b}`,
  }[operation];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="relative bg-card border border-border rounded-2xl p-4 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">
          🎮 Gioco: {operationLabel}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Division game */}
      {operation === "divisione" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-4">
            {/* Available items */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground font-medium">
                Trascina le {emoji} nei cestini ({availableItems.length} rimaste)
              </p>
              <div className="flex flex-wrap gap-1 justify-center max-w-[300px]">
                {availableItems.map((id) => (
                  <DraggableItem key={id} id={id} emoji={emoji} isDragging={activeId === id} />
                ))}
              </div>
            </div>

            {/* Buckets */}
            <div className="flex gap-2 justify-center flex-wrap">
              {Object.entries(buckets).map(([bucketId, items], idx) => (
                <DroppableBucket
                  key={bucketId}
                  id={bucketId}
                  items={items}
                  emoji={emoji}
                  label={`Cesto ${idx + 1}`}
                />
              ))}
            </div>

            {divisionDone && (
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center text-lg font-bold text-primary">
                {Math.floor(a / b)} {emoji} per cesto! ✅
              </motion.p>
            )}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="w-11 h-11 flex items-center justify-center text-2xl scale-125 rounded-xl bg-white shadow-lg border-2 border-primary">
                {emoji}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Multiplication game */}
      {operation === "moltiplicazione" && (
        <ClickableGrid rows={a} cols={b} emoji={emoji} onComplete={handleAnswer} />
      )}

      {/* Addition game */}
      {operation === "addizione" && (
        <AdditionMerge a={a} b={b} emoji={emoji} onComplete={handleAnswer} />
      )}

      {/* Subtraction game */}
      {operation === "sottrazione" && (
        <SubtractionGame a={a} b={b} emoji={emoji} onComplete={handleAnswer} />
      )}
    </motion.div>
  );
}
