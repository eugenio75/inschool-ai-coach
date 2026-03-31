import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText, Download, Pencil, Archive, Share2, Loader2,
  Sparkles, Trash2, Undo2, RotateCcw,
} from "lucide-react";
import { splitTeacherContent, renderAndPrintPdf } from "@/lib/pdfExport";
import { MathText } from "@/components/shared/MathText";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Helpers ──

const TYPE_MAP: Record<string, string> = {
  compito: "Compito", verifica: "Verifica", esercizi: "Esercizi",
  recupero: "Recupero", potenziamento: "Potenziamento", lezione: "Lezione",
};

export function typeLabel(t: string | null) {
  return TYPE_MAP[t || ""] || t || "—";
}

/** Render markdown content into React elements */
export function formatMaterialContent(raw: string) {
  if (!raw) return null;
  let text = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let idx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t === "") continue;
    if (/^[-]{3,}$/.test(t) || /^[*]{3,}$/.test(t)) { elements.push(<hr key={idx++} className="my-5 border-border" />); continue; }
    if (t.startsWith("#### ")) {
      elements.push(<h4 key={idx++} className="text-sm font-bold text-foreground mt-5 mb-1.5 flex items-center gap-2"><span className="w-1 h-4 bg-primary rounded-full shrink-0" /><span>{inlineMarkdown(t.replace(/^#{4,}\s+/, ""))}</span></h4>);
      continue;
    }
    if (t.startsWith("### ")) {
      elements.push(<h3 key={idx++} className="text-base font-bold text-foreground mt-6 mb-2 pb-1.5 border-b border-border">{inlineMarkdown(t.replace(/^###\s+/, ""))}</h3>);
      continue;
    }
    if (t.startsWith("## ")) {
      elements.push(<h2 key={idx++} className="text-lg font-bold text-foreground mt-6 mb-2">{inlineMarkdown(t.replace(/^##\s+/, ""))}</h2>);
      continue;
    }
    if (t.startsWith("$$")) {
      let math = t.substring(2);
      if (math.endsWith("$$")) { math = math.slice(0, -2); }
      else { while (i + 1 < lines.length) { i++; const next = lines[i].trim(); if (next.endsWith("$$")) { math += "\n" + next.slice(0, -2); break; } math += "\n" + next; } }
      elements.push(<div key={idx++} className="my-3 py-3 px-4 bg-muted/50 rounded-lg border border-border text-center overflow-x-auto"><MathText>{`$$${math.trim()}$$`}</MathText></div>);
      continue;
    }
    const numMatch = t.match(/^(\d+)[.)]\s+(.*)/);
    if (numMatch) { elements.push(<div key={idx++} className="flex gap-3 items-baseline pl-1 py-0.5"><span className="font-semibold text-primary min-w-[1.5rem] text-right shrink-0">{numMatch[1]}.</span><span className="flex-1">{inlineMarkdown(numMatch[2])}</span></div>); continue; }
    const bulletMatch = t.match(/^[-•]\s+(.*)/);
    if (bulletMatch) { elements.push(<div key={idx++} className="flex gap-3 items-baseline pl-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-[0.4em]" /><span className="flex-1">{inlineMarkdown(bulletMatch[1])}</span></div>); continue; }
    elements.push(<p key={idx++} className="py-0.5 leading-relaxed">{inlineMarkdown(t)}</p>);
  }
  return <div className="space-y-1">{elements}</div>;
}

function inlineMarkdown(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push(<MathText key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</MathText>);
    if (match[2]) segments.push(<strong key={`b${match.index}`}><MathText>{match[2]}</MathText></strong>);
    else if (match[3]) segments.push(<em key={`i${match.index}`}><MathText>{match[3]}</MathText></em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push(<MathText key={`r${lastIndex}`}>{text.slice(lastIndex)}</MathText>);
  return segments.length === 0 ? <MathText>{text}</MathText> : <>{segments}</>;
}

// ── Types ──

type PreviewTab = "student" | "teacher" | "bes" | "dsa" | "h";

export interface SharedMaterialsListProps {
  materials: any[];
  setMaterials: React.Dispatch<React.SetStateAction<any[]>>;
  adaptedMap: Record<string, Record<string, any>>;
  setAdaptedMap: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
  classMap: Record<string, string>;
  classi?: any[];
  userId: string;
  onReload?: () => void;
}

export default function SharedMaterialsList({
  materials, setMaterials, adaptedMap, setAdaptedMap, classMap, classi, userId, onReload,
}: SharedMaterialsListProps) {
  // Preview
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);
  const [previewVersion, setPreviewVersion] = useState<PreviewTab>("student");
  const [previewEditing, setPreviewEditing] = useState(false);
  const [previewEditContent, setPreviewEditContent] = useState("");
  const [previewEditSaving, setPreviewEditSaving] = useState(false);
  const [regeneratingVersion, setRegeneratingVersion] = useState<string | null>(null);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);

  // Share
  const [shareMaterial, setShareMaterial] = useState<any | null>(null);
  const [shareClassIds, setShareClassIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // ── Actions ──

  async function handleArchive(id: string, current: string) {
    const newStatus = current === "archived" ? "draft" : "archived";
    const { error } = await supabase.from("teacher_materials").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Errore"); return; }
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    toast.success(newStatus === "archived" ? "Archiviato" : "Ripristinato");
  }

  function handleDownloadPdf(m: any, version: "student" | "teacher" | "full" = "full") {
    const className = m.class_id && classMap[m.class_id] ? classMap[m.class_id] : "";
    const dateStr = new Date(m.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    const hasSolutions = (m.content || "").includes("===SOLUZIONI===");
    if (hasSolutions && version !== "full") {
      const { studentContent } = splitTeacherContent(m.content || "");
      const isTeacherVersion = version === "teacher";
      renderAndPrintPdf(isTeacherVersion ? (m.content || "") : studentContent, {
        title: m.title, type: m.type || "esercizi",
        subject: [m.subject, m.level ? "Livello: " + m.level : ""].filter(Boolean).join(" · "),
        className, date: dateStr, isTeacherOnly: isTeacherVersion,
      });
    } else {
      renderAndPrintPdf(m.content || "", {
        title: m.title, type: m.type || "esercizi",
        subject: [m.subject, m.level ? "Livello: " + m.level : ""].filter(Boolean).join(" · "),
        className, date: dateStr,
      });
    }
  }

  function handleDownloadAdaptedPdf(adaptedMat: any, version: "BES" | "DSA" | "H") {
    const className = adaptedMat.class_id && classMap[adaptedMat.class_id] ? classMap[adaptedMat.class_id] : "";
    const dateStr = new Date(adaptedMat.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    renderAndPrintPdf(adaptedMat.content || "", {
      title: adaptedMat.title, type: adaptedMat.type || "esercizi",
      subject: [adaptedMat.subject, adaptedMat.level ? "Livello: " + adaptedMat.level : ""].filter(Boolean).join(" · "),
      className, date: dateStr, adaptedVersion: version,
    });
  }

  async function executeDelete(id: string) {
    await supabase.from("teacher_materials").delete().eq("parent_material_id", id);
    await supabase.from("teacher_materials").delete().eq("id", id);
    setMaterials(prev => prev.filter(m => m.id !== id));
    setAdaptedMap(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    setPreviewMaterial(null);
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteConfirmText("");
    toast.success("Materiale eliminato");
  }

  async function handlePreviewEditSave() {
    if (!previewMaterial) return;
    setPreviewEditSaving(true);
    try {
      if (previewVersion === "student" || previewVersion === "teacher") {
        const hasSolutions = (previewMaterial.content || "").includes("===SOLUZIONI===");
        let newContent: string;
        if (previewVersion === "student" && hasSolutions) {
          const { teacherContent } = splitTeacherContent(previewMaterial.content || "");
          newContent = teacherContent ? `${previewEditContent}\n\n===SOLUZIONI===\n\n${teacherContent}` : previewEditContent;
        } else if (previewVersion === "teacher" && hasSolutions) {
          const { studentContent } = splitTeacherContent(previewMaterial.content || "");
          newContent = `${studentContent}\n\n===SOLUZIONI===\n\n${previewEditContent}`;
        } else {
          newContent = previewEditContent;
        }
        await supabase.from("teacher_materials").update({ content: newContent, updated_at: new Date().toISOString() }).eq("id", previewMaterial.id);
        setPreviewMaterial({ ...previewMaterial, content: newContent });
        setMaterials(prev => prev.map(m => m.id === previewMaterial.id ? { ...m, content: newContent } : m));
        toast.success("Contenuto aggiornato");
        if (previewVersion === "student") {
          const adapted = adaptedMap[previewMaterial.id];
          if (adapted && Object.keys(adapted).length > 0) setShowRegenPrompt(true);
        }
      } else {
        const adapted = adaptedMap[previewMaterial.id];
        const adaptedMat = adapted?.[previewVersion];
        if (adaptedMat) {
          await supabase.from("teacher_materials").update({ content: previewEditContent, updated_at: new Date().toISOString() }).eq("id", adaptedMat.id);
          setAdaptedMap(prev => ({ ...prev, [previewMaterial.id]: { ...prev[previewMaterial.id], [previewVersion]: { ...adaptedMat, content: previewEditContent } } }));
          toast.success("Versione adattata aggiornata");
        }
      }
    } catch { toast.error("Errore nel salvataggio"); }
    setPreviewEditSaving(false);
    setPreviewEditing(false);
  }

  async function regenerateSingleVersion(materialId: string, version: "bes" | "dsa" | "h") {
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return;
    setRegeneratingVersion(version);
    try {
      const { studentContent } = splitTeacherContent(mat.content || "");
      const versionLabels: Record<string, string> = {
        bes: "BES (Bisogni Educativi Speciali): Simplify language and instructions. Use shorter sentences. Break complex tasks into smaller steps.",
        dsa: "DSA (Disturbi Specifici dell'Apprendimento): Further simplify written instructions. Use numbered lists. Avoid copying tasks. Suggest compensatory tools. Use clear visual spacing.",
        h: "H (Disabilità certificata — obiettivi minimi): Reduce to core essential concepts. Very simple language. Maximum 3-4 tasks. Include visual support suggestions.",
      };
      const systemPrompt = `You are an Italian special education specialist. Adapt the following educational material for ${version.toUpperCase()} students:\n\n${versionLabels[version]}\n\nReturn only the adapted version in Italian, no commentary.`;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ stream: false, maxTokens: 3000, systemPrompt, messages: [{ role: "user", content: `MATERIALE ORIGINALE:\n---\n${studentContent}\n---` }] }),
      });
      const data = await res.json();
      const output = data.choices?.[0]?.message?.content?.trim() || "";
      if (!output) throw new Error("Empty response");
      const adapted = adaptedMap[materialId];
      const existing = adapted?.[version];
      if (existing) {
        await supabase.from("teacher_materials").update({ content: output, updated_at: new Date().toISOString() }).eq("id", existing.id);
        setAdaptedMap(prev => ({ ...prev, [materialId]: { ...prev[materialId], [version]: { ...existing, content: output } } }));
      } else {
        const { data: inserted } = await supabase.from("teacher_materials").insert({
          teacher_id: userId, class_id: mat.class_id, title: `${mat.title} — ${version.toUpperCase()}`,
          subject: mat.subject, type: mat.type, content: output, target_profile: version,
          parent_material_id: materialId, is_sample: mat.is_sample || false, status: "draft",
        }).select("*").single();
        if (inserted) setAdaptedMap(prev => ({ ...prev, [materialId]: { ...(prev[materialId] || {}), [version]: inserted } }));
      }
      toast.success(`Versione ${version.toUpperCase()} rigenerata`);
    } catch { toast.error("Errore nella rigenerazione"); }
    finally { setRegeneratingVersion(null); }
  }

  async function regenerateAllAdapted(materialId: string) {
    setShowRegenPrompt(false);
    for (const v of ["bes", "dsa", "h"] as const) await regenerateSingleVersion(materialId, v);
  }

  async function handleShare() {
    if (!shareMaterial || shareClassIds.length === 0) return;
    setSharing(true);
    const inserts = shareClassIds.map(classId => ({
      teacher_id: userId, class_id: classId, title: shareMaterial.title,
      subject: shareMaterial.subject, type: shareMaterial.type, level: shareMaterial.level,
      content: shareMaterial.content, status: "draft" as const, target_profile: shareMaterial.target_profile,
    }));
    const { error } = await supabase.from("teacher_materials").insert(inserts);
    setSharing(false);
    if (error) { toast.error("Errore nella condivisione"); return; }
    toast.success(`Materiale condiviso con ${shareClassIds.length} ${shareClassIds.length === 1 ? "classe" : "classi"}`);
    setShareMaterial(null);
    onReload?.();
  }

  const shareableClasses = useMemo(() => {
    if (!shareMaterial || !classi) return classi || [];
    return (classi || []).filter(c => c.id !== shareMaterial.class_id);
  }, [classi, shareMaterial]);

  // ── Render ──
  return (
    <>
      {/* Cards */}
      <div className="space-y-2">
        {materials.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setPreviewMaterial(m)}
          >
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground truncate">{m.title}</h3>
                <Badge variant="outline" className="text-[10px]">{typeLabel(m.type)}</Badge>
                {(m.content || "").includes("===SOLUZIONI===") && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-full cursor-help"
                    title="Questo materiale contiene soluzioni e griglie riservate al docente"
                  >
                    🔒 Docente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                {m.class_id && classMap[m.class_id] && <span>{classMap[m.class_id]}</span>}
                {m.subject && <span>{m.subject}</span>}
                <span>{new Date(m.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => handleArchive(m.id, m.status)}>
                {m.status === "archived" ? <><Undo2 className="w-3.5 h-3.5" /> Ripristina</> : <><Archive className="w-3.5 h-3.5" /> Archivia</>}
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => { setDeleteTarget(m); setDeleteStep(1); setDeleteConfirmText(""); }}>
                <Trash2 className="w-3.5 h-3.5" /> Elimina
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Preview dialog ── */}
      <Dialog open={!!previewMaterial} onOpenChange={open => {
        if (!open) { setPreviewMaterial(null); setPreviewVersion("student"); setPreviewEditing(false); setShowRegenPrompt(false); }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewMaterial && (() => {
            const hasSolutions = (previewMaterial.content || "").includes("===SOLUZIONI===");
            const { studentContent, teacherContent } = hasSolutions
              ? splitTeacherContent(previewMaterial.content || "")
              : { studentContent: previewMaterial.content || "", teacherContent: null };
            const adapted = adaptedMap[previewMaterial.id] || {};
            let displayContent = "";
            if (previewVersion === "student") displayContent = studentContent;
            else if (previewVersion === "teacher") displayContent = teacherContent || studentContent;
            else if (adapted[previewVersion]) displayContent = adapted[previewVersion].content || "";
            const isAdaptedTab = ["bes", "dsa", "h"].includes(previewVersion);
            const adaptedExists = isAdaptedTab && adapted[previewVersion];
            const isRegenerating = regeneratingVersion === previewVersion;
            const tabs: { key: PreviewTab; emoji: string; label: string; show: boolean }[] = [
              { key: "student", emoji: "📄", label: "Studente", show: true },
              { key: "teacher", emoji: "🔒", label: "Docente", show: hasSolutions },
              { key: "bes", emoji: "🟡", label: "BES", show: true },
              { key: "dsa", emoji: "🔵", label: "DSA", show: true },
              { key: "h", emoji: "🟢", label: "H", show: true },
            ];
            return (
              <>
                <DialogHeader>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg">{previewMaterial.title}</DialogTitle>
                    <DialogDescription asChild>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{typeLabel(previewMaterial.type)}</Badge>
                        {previewMaterial.subject && <Badge variant="secondary" className="text-[10px]">{previewMaterial.subject}</Badge>}
                        {previewMaterial.class_id && classMap[previewMaterial.class_id] && (
                          <span className="text-[11px] text-muted-foreground">{classMap[previewMaterial.class_id]}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(previewMaterial.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                    </DialogDescription>
                  </div>
                </DialogHeader>

                {/* Version toggle bar */}
                <div className="flex items-center gap-1 mt-3 p-1 bg-muted rounded-lg overflow-x-auto">
                  {tabs.filter(t => t.show).map(tab => (
                    <button key={tab.key} onClick={() => { setPreviewVersion(tab.key); setPreviewEditing(false); }}
                      className={cn("px-2.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                        previewVersion === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}>
                      {tab.emoji} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Per-version action bar */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {!previewEditing ? (
                    <>
                      <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                        onClick={() => { setPreviewEditing(true); setPreviewEditContent(displayContent); }}
                        disabled={isAdaptedTab && !adaptedExists}>
                        <Pencil className="w-3 h-3 mr-1" /> Modifica
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                        onClick={() => {
                          if (previewVersion === "student") handleDownloadPdf(previewMaterial, hasSolutions ? "student" : "full");
                          else if (previewVersion === "teacher") handleDownloadPdf(previewMaterial, "teacher");
                          else if (adaptedExists) handleDownloadAdaptedPdf(adapted[previewVersion], previewVersion.toUpperCase() as "BES" | "DSA" | "H");
                        }}
                        disabled={isAdaptedTab && !adaptedExists}>
                        <Download className="w-3 h-3 mr-1" /> Scarica PDF
                      </Button>
                      {classi && classi.length > 0 && (
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                          onClick={() => { setShareMaterial(previewMaterial); setShareClassIds([]); }}>
                          <Share2 className="w-3 h-3 mr-1" /> Condividi
                        </Button>
                      )}
                      {isAdaptedTab && (
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                          disabled={isRegenerating}
                          onClick={() => regenerateSingleVersion(previewMaterial.id, previewVersion as "bes" | "dsa" | "h")}>
                          {isRegenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                          {adaptedExists ? "Rigenera" : "Genera"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-7 text-xs rounded-lg" disabled={previewEditSaving} onClick={handlePreviewEditSave}>
                        {previewEditSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} Salva
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setPreviewEditing(false)}>Annulla</Button>
                    </>
                  )}
                </div>

                {/* Teacher-only banner */}
                {previewVersion === "teacher" && hasSolutions && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300">
                    🔒 Contenuto riservato al docente
                  </div>
                )}

                {/* Content area */}
                {isAdaptedTab && !adaptedExists && !isRegenerating ? (
                  <div className="mt-2 bg-muted/30 border border-border rounded-xl p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Versione {previewVersion.toUpperCase()} non ancora generata</p>
                    <Button size="sm" onClick={() => regenerateSingleVersion(previewMaterial.id, previewVersion as "bes" | "dsa" | "h")}>
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Genera versione {previewVersion.toUpperCase()}
                    </Button>
                  </div>
                ) : isRegenerating ? (
                  <div className="mt-2 bg-muted/30 border border-border rounded-xl p-8 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Generazione in corso...</p>
                  </div>
                ) : previewEditing ? (
                  <div className="mt-2">
                    <Textarea value={previewEditContent} onChange={e => setPreviewEditContent(e.target.value)} className="min-h-[300px] font-mono text-xs" />
                  </div>
                ) : (
                  <div className="mt-2 bg-muted/30 border border-border rounded-xl p-5">
                    <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed">
                      {formatMaterialContent(displayContent)}
                    </div>
                  </div>
                )}

                {/* Regen prompt */}
                {showRegenPrompt && (
                  <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                    <p className="text-xs font-medium text-foreground">Hai modificato il materiale base. Vuoi rigenerare le versioni BES, DSA e H?</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => regenerateAllAdapted(previewMaterial.id)}>Sì, rigenera</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowRegenPrompt(false)}>No, mantieni le versioni esistenti</Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Share dialog ── */}
      {classi && classi.length > 0 && (
        <Dialog open={!!shareMaterial} onOpenChange={open => !open && setShareMaterial(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Condividi con altre classi</DialogTitle>
              <DialogDescription>Seleziona le classi a cui vuoi assegnare una copia di "{shareMaterial?.title}".</DialogDescription>
            </DialogHeader>
            <div className="py-3 space-y-2 max-h-60 overflow-y-auto">
              {shareableClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun'altra classe disponibile.</p>
              ) : shareableClasses.map(c => (
                <label key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox checked={shareClassIds.includes(c.id)} onCheckedChange={() => setShareClassIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} />
                  <span className="text-sm font-medium text-foreground">{c.nome}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareMaterial(null)}>Annulla</Button>
              <Button disabled={shareClassIds.length === 0 || sharing} onClick={handleShare}>
                {sharing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
                Condividi ({shareClassIds.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete confirmation (double step) ── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteStep(1); setDeleteConfirmText(""); } }}>
        <DialogContent className="sm:max-w-md">
          {deleteStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Eliminare materiale?</DialogTitle>
                <DialogDescription>Vuoi eliminare "{deleteTarget?.title}"? Verranno eliminate anche tutte le versioni BES, DSA e H associate.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}>Annulla</Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>Continua</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Conferma eliminazione</DialogTitle>
                <DialogDescription>Questa azione è irreversibile. Digita il titolo del materiale per confermare.</DialogDescription>
              </DialogHeader>
              <div className="py-3">
                <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder={deleteTarget?.title || ""} className="text-sm" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(1); setDeleteConfirmText(""); }}>Annulla</Button>
                <Button variant="destructive" disabled={deleteConfirmText !== (deleteTarget?.title || "")} onClick={() => deleteTarget && executeDelete(deleteTarget.id)}>
                  Elimina definitivamente
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
