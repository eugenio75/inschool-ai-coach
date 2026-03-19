import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MathNotepadProps {
  open: boolean;
  onClose: () => void;
}

const GRID_ROWS = 14;
const GRID_COLS = 10;

type CellValue = string;

const OPERATOR_KEYS = ["+", "−", "×", "÷", "=", ".", "—"];
const DIGIT_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const createEmptyGrid = (): CellValue[][] =>
  Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(""));

export const MathNotepad = ({ open, onClose }: MathNotepadProps) => {
  const [grid, setGrid] = useState<CellValue[][]>(createEmptyGrid);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const setCellValue = useCallback((row: number, col: number, value: string) => {
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = value;
      return next;
    });
  }, []);

  const handleCellTap = (row: number, col: number) => {
    setSelectedCell([row, col]);
    setFeedback(null);
  };

  const handleKeyInput = (key: string) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;
    
    // "—" fills the rest of the row as a separator line for divisions
    if (key === "—") {
      setGrid(prev => {
        const next = prev.map(r => [...r]);
        for (let c = col; c < GRID_COLS; c++) {
          next[row][c] = "—";
        }
        return next;
      });
      if (row < GRID_ROWS - 1) setSelectedCell([row + 1, 0]);
      return;
    }
    
    setCellValue(row, col, key);
    if (col < GRID_COLS - 1) {
      setSelectedCell([row, col + 1]);
    } else if (row < GRID_ROWS - 1) {
      setSelectedCell([row + 1, 0]);
    }
    setFeedback(null);
  };

  const handleDelete = () => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;
    if (grid[row][col]) {
      setCellValue(row, col, "");
    } else {
      if (col > 0) {
        setSelectedCell([row, col - 1]);
        setCellValue(row, col - 1, "");
      } else if (row > 0) {
        setSelectedCell([row - 1, GRID_COLS - 1]);
        setCellValue(row - 1, GRID_COLS - 1, "");
      }
    }
    setFeedback(null);
  };

  const handleClear = () => {
    setGrid(createEmptyGrid());
    setSelectedCell(null);
    setFeedback(null);
  };

  const gridToText = (): string => {
    const lines: string[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const line = grid[r].join("");
      const trimmed = line.trimEnd();
      if (trimmed.trim()) lines.push(trimmed);
    }
    return lines.join("\n");
  };

  const hasContent = grid.some(row => row.some(cell => cell !== ""));

  const handleCheck = async () => {
    const text = gridToText();
    if (!text.trim() || checking) return;

    setChecking(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Controlla questa operazione scritta sul mio blocco note. Dimmi SOLO se il risultato è corretto o sbagliato e, se sbagliato, dove ho sbagliato (in 1-2 frasi brevi). Non riscrivere l'intera operazione.\n\n${text}`,
              },
            ],
            taskContext: { title: "Controllo operazione", subject: "Matematica" },
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Errore di connessione");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) result += content;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      const isCorrect = /corrett[aio]|giusto|esatto|perfetto|brav/i.test(result) && 
                        !/non è corrett|sbagliato|errore|scorrett/i.test(result);
      setFeedback({ correct: isCorrect, message: result.trim() });
    } catch (err) {
      console.error("Check error:", err);
      setFeedback({ correct: false, message: "Non riesco a controllare in questo momento. Riprova!" });
    } finally {
      setChecking(false);
    }
  };

  // Physical keyboard support
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "ArrowRight") {
        const [r, c] = selectedCell;
        if (c < GRID_COLS - 1) setSelectedCell([r, c + 1]);
      } else if (e.key === "ArrowLeft") {
        const [r, c] = selectedCell;
        if (c > 0) setSelectedCell([r, c - 1]);
      } else if (e.key === "ArrowDown") {
        const [r, c] = selectedCell;
        if (r < GRID_ROWS - 1) setSelectedCell([r + 1, c]);
      } else if (e.key === "ArrowUp") {
        const [r, c] = selectedCell;
        if (r > 0) setSelectedCell([r - 1, c]);
      } else if (e.key === "Enter") {
        const [r] = selectedCell;
        if (r < GRID_ROWS - 1) setSelectedCell([r + 1, 0]);
      } else if (/^[0-9+\-×÷=.*]$/.test(e.key)) {
        let mapped = e.key;
        if (mapped === "*") mapped = "×";
        if (mapped === "/") mapped = "÷";
        if (mapped === "-") mapped = "−";
        handleKeyInput(mapped);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selectedCell, grid]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-primary" /></div>
              <h3 className="font-display font-semibold text-foreground text-sm">Blocco Note</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!hasContent}
                className="text-xs h-8 px-2"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Pulisci
              </Button>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid area */}
          <div className="flex-1 overflow-auto px-3 py-3 flex flex-col items-center">
            <div
              ref={gridRef}
              className="inline-grid gap-0 border border-border rounded-xl overflow-hidden bg-card"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isSeparator = cell === "—";
                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => handleCellTap(r, c)}
                      className={`w-9 h-9 sm:w-10 sm:h-10 border border-border/30 flex items-center justify-center text-lg font-mono font-semibold transition-colors
                        ${isSelected ? "bg-primary/15 ring-2 ring-primary ring-inset" : "bg-card hover:bg-muted/50"}
                        ${isSeparator ? "text-border" : cell && !isSelected ? "text-foreground" : "text-muted-foreground"}
                      `}
                    >
                      {isSeparator ? "━" : cell}
                    </button>
                  );
                })
              )}
            </div>

            {/* AI Feedback banner */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`mt-3 w-full max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    feedback.correct
                      ? "bg-sage-light text-sage-dark border border-primary/20"
                      : "bg-clay-light text-clay-dark border border-clay-dark/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{feedback.correct ? "✅" : "🔄"}</span>
                    <p>{feedback.message}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Virtual keyboard */}
          <div className="shrink-0 border-t border-border bg-muted/30 px-3 py-2 pb-safe">
            {/* Digits row */}
            <div className="flex justify-center gap-1.5 mb-1.5">
              {DIGIT_KEYS.map(d => (
                <button
                  key={d}
                  onClick={() => handleKeyInput(d)}
                  className="w-9 h-10 sm:w-10 sm:h-11 rounded-lg bg-card border border-border text-foreground font-mono text-lg font-semibold hover:bg-muted active:bg-primary/10 transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
            {/* Operators + actions row */}
            <div className="flex justify-center gap-1.5">
              {OPERATOR_KEYS.map(op => (
                <button
                  key={op}
                  onClick={() => handleKeyInput(op)}
                  className="w-9 h-10 sm:w-10 sm:h-11 rounded-lg bg-sage-light border border-border text-sage-dark font-mono text-lg font-semibold hover:bg-accent active:bg-primary/10 transition-colors"
                  title={op === "—" ? "Linea separatore (divisioni)" : undefined}
                >
                  {op === "—" ? "━" : op}
                </button>
              ))}
              <button
                onClick={handleDelete}
                className="w-12 h-10 sm:w-14 sm:h-11 rounded-lg bg-clay-light border border-border text-clay-dark flex items-center justify-center hover:bg-accent active:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Check button */}
            <div className="mt-2 flex justify-center">
              <Button
                onClick={handleCheck}
                disabled={!hasContent || checking}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-6 py-2.5 text-sm font-medium gap-2"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Controllo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Controlla
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
