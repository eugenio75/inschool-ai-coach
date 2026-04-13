import { toast } from "sonner";

/**
 * Shared PDF export utilities — single source of truth for all teacher PDF rendering.
 */

/** Convert markdown-like content string to structured HTML */
export function markdownToHtml(raw: string): string {
  const content = raw.replace(/\\n/g, "\n");
  return content
    .split("\n")
    .map((line: string) => {
      const t = line.trim();
      if (!t) return "<br/>";
      if (/^-{3,}$/.test(t)) return '<hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>';
      if (t.startsWith("#### ")) return `<h4 style="margin:18px 0 6px;font-size:14px;font-weight:700;color:#1A3A5C">${t.slice(5)}</h4>`;
      if (t.startsWith("### ")) return `<h3 style="margin:20px 0 8px;font-size:16px;font-weight:700;border-bottom:1px solid #eee;padding-bottom:4px">${t.slice(4)}</h3>`;
      if (t.startsWith("## ")) return `<h2 style="margin:24px 0 10px;font-size:18px;font-weight:700">${t.slice(3)}</h2>`;
      const numMatch = t.match(/^(\d+)[.)]\s+(.*)/);
      if (numMatch) return `<div style="display:flex;gap:10px;margin:4px 0 4px 8px"><span style="font-weight:600;color:#0070C0;min-width:20px;text-align:right">${numMatch[1]}.</span><span>${numMatch[2]}</span></div>`;
      const bulletMatch = t.match(/^[-•]\s+(.*)/);
      if (bulletMatch) return `<div style="display:flex;gap:10px;margin:4px 0 4px 8px"><span style="color:#0070C0">•</span><span>${bulletMatch[1]}</span></div>`;
      return `<p style="margin:4px 0">${t}</p>`;
    })
    .join("")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

interface PdfMeta {
  title: string;
  type: string;
  subject?: string;
  className?: string;
  date?: string;
  isTeacherOnly?: boolean;
  /** Adapted version badge: "BES" | "DSA" | "H" */
  adaptedVersion?: "BES" | "DSA" | "H";
}

/** Build a full PDF HTML document from content and metadata */
export function buildPdfHtml(htmlContent: string, meta: PdfMeta): string {
  const isVerifica = meta.type === "verifica";
  const isTeacherOnly = meta.isTeacherOnly === true;
  const showStudentFields = !isTeacherOnly;
  const adapted = meta.adaptedVersion;
  const adaptedColors: Record<string, { bg: string; color: string; label: string }> = {
    BES: { bg: "#FFF8E1", color: "#F9A825", label: "🟡 Versione BES" },
    DSA: { bg: "#E3F2FD", color: "#1565C0", label: "🔵 Versione DSA" },
    H: { bg: "#E8F5E9", color: "#2E7D32", label: "🟢 Versione H — da adattare al PEI" },
  };
  const adaptedMeta = adapted ? adaptedColors[adapted] : null;
  const headerColor = adaptedMeta ? adaptedMeta.color : isTeacherOnly ? "#2E7D32" : isVerifica ? "#c0392b" : "#1A3A5C";
  const dateStr = meta.date || new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const typeLabel = meta.type ? meta.type.charAt(0).toUpperCase() + meta.type.slice(1) : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${meta.title}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a1a; max-width: 700px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid ${headerColor}; }
  .header h1 { font-size: 20px; margin: 0 0 8px; color: ${headerColor}; }
  .header .meta { font-size: 11px; color: #888; }
  ${isTeacherOnly ? `.header .badge { display:inline-block; background:#2E7D3220; color:#2E7D32; padding:2px 12px; border-radius:12px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }` : ""}
  ${adaptedMeta ? `.header .adapted-badge { display:inline-block; background:${adaptedMeta.bg}; color:${adaptedMeta.color}; padding:4px 16px; border-radius:12px; font-size:12px; font-weight:700; letter-spacing:0.03em; margin-bottom:10px; border:1px solid ${adaptedMeta.color}30; }` : ""}
  .student-fields { margin: 16px 0; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
  .student-fields p { margin: 4px 0; font-size: 12px; }
  .content { margin-top: 16px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  ${isTeacherOnly ? `<div class="badge">⚠ RISERVATO AL DOCENTE</div>` : ""}
  ${adaptedMeta ? `<div class="adapted-badge">${adaptedMeta.label}</div>` : ""}
  <h1>${meta.title}${isTeacherOnly ? " — Soluzioni" : ""}</h1>
  <div class="meta">${[typeLabel, meta.subject, meta.className, dateStr].filter(Boolean).join(" · ")}</div>
</div>
${showStudentFields ? `<div class="student-fields"><p><strong>Nome e Cognome:</strong> _______________________________________ <strong>Classe:</strong> _____________ <strong>Data:</strong> _____________</p></div>` : ""}
<div class="content">${htmlContent}</div>
</body></html>`;
}

/** Open a print window with the given HTML */
export function printPdfHtml(html: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    toast.error("Popup bloccato dal browser");
    return;
  }
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 300);
  };
}

/** All-in-one: render content to PDF and open print dialog */
export function renderAndPrintPdf(content: string, meta: PdfMeta): void {
  const htmlContent = markdownToHtml(content);
  const fullHtml = buildPdfHtml(htmlContent, meta);
  printPdfHtml(fullHtml);
}

// --- Griglia / Solutions separator ---

const TEACHER_ONLY_KEYWORDS = [
  "griglia di valutazione",
  "griglia valutazione",
  "criteri di valutazione",
  "risposte corrette",
  "soluzioni",
  "per il docente",
  "riservato al docente",
  "chiave di correzione",
  "criterio di valutazione",
];

/**
 * Detect and split teacher-only content from student content.
 * Returns { studentContent, teacherContent, wasAutoSplit }.
 * If ===SOLUZIONI=== is present, splits there.
 * Otherwise, uses keyword heuristic to find the split point.
 */
export function splitTeacherContent(raw: string): {
  studentContent: string;
  teacherContent: string | null;
  wasAutoSplit: boolean;
} {
  // Explicit separator
  if (raw.includes("===SOLUZIONI===")) {
    const parts = raw.split("===SOLUZIONI===");
    return {
      studentContent: parts[0].trim(),
      teacherContent: parts[1]?.trim() || null,
      wasAutoSplit: false,
    };
  }

  // Fallback: keyword-based detection
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (TEACHER_ONLY_KEYWORDS.some(kw => lower.includes(kw))) {
      // Check it's a heading-like line (starts with # or is a standalone keyword line)
      const trimmed = lines[i].trim();
      const isHeading = trimmed.startsWith("#") || trimmed.startsWith("**") || /^[\d]+[.)]\s/.test(trimmed) === false;
      if (isHeading) {
        return {
          studentContent: lines.slice(0, i).join("\n").trim(),
          teacherContent: lines.slice(i).join("\n").trim(),
          wasAutoSplit: true,
        };
      }
    }
  }

  return { studentContent: raw, teacherContent: null, wasAutoSplit: false };
}
