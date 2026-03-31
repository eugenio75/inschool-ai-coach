import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, FolderOpen, FileText, Download, Pencil, Archive, Share2, Loader2, X, Eye, RotateCcw, CalendarIcon, ChevronDown, Sparkles, Trash2, Undo2 } from "lucide-react";
import { splitTeacherContent } from "@/lib/pdfExport";
import { MathText } from "@/components/shared/MathText";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { renderAndPrintPdf } from "@/lib/pdfExport";

const TYPE_OPTIONS = [
  { key: "all", label: "Tutti i tipi" },
  { key: "compito", label: "Compito" },
  { key: "verifica", label: "Verifica" },
  { key: "esercizi", label: "Esercizi" },
  { key: "recupero", label: "Recupero" },
  { key: "potenziamento", label: "Potenziamento" },
];

const STATUS_OPTIONS = [
  { key: "all", label: "Tutti gli stati" },
  { key: "assigned", label: "Assegnato" },
  { key: "draft", label: "Non assegnato" },
  { key: "archived", label: "Archiviato" },
];

function statusLabel(s: string | null) {
  if (s === "assigned") return "Assegnato";
  if (s === "archived") return "Archiviato";
  return "Non assegnato";
}

function statusVariant(s: string | null): "default" | "secondary" | "outline" {
  if (s === "assigned") return "default";
  if (s === "archived") return "outline";
  return "secondary";
}

function typeLabel(t: string | null) {
  const found = TYPE_OPTIONS.find(o => o.key === t);
  return found ? found.label : t || "—";
}

/** Convert markdown content to structured React elements */
function formatMaterialContent(raw: string) {
  if (!raw) return null;
  
  // Normalize: replace literal \n sequences AND ensure real newlines
  let text = raw;
  // Handle literal backslash-n from DB
  text = text.replace(/\\n/g, "\n");
  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let idx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    
    // Empty line → skip
    if (t === "") continue;
    
    // Horizontal rule: --- or ***
    if (/^[-]{3,}$/.test(t) || /^[*]{3,}$/.test(t)) {
      elements.push(<hr key={idx++} className="my-5 border-border" />);
      continue;
    }

    // Heading ####
    if (t.startsWith("#### ")) {
      const content = t.replace(/^#{4,}\s+/, "");
      elements.push(
        <h4 key={idx++} className="text-sm font-bold text-foreground mt-5 mb-1.5 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full shrink-0" />
          <span>{inlineMarkdown(content)}</span>
        </h4>
      );
      continue;
    }
    
    // Heading ###
    if (t.startsWith("### ")) {
      const content = t.replace(/^###\s+/, "");
      elements.push(
        <h3 key={idx++} className="text-base font-bold text-foreground mt-6 mb-2 pb-1.5 border-b border-border">
          {inlineMarkdown(content)}
        </h3>
      );
      continue;
    }
    
    // Heading ##
    if (t.startsWith("## ")) {
      const content = t.replace(/^##\s+/, "");
      elements.push(
        <h2 key={idx++} className="text-lg font-bold text-foreground mt-6 mb-2">
          {inlineMarkdown(content)}
        </h2>
      );
      continue;
    }

    // Display math $$...$$ (may span multiple lines)
    if (t.startsWith("$$")) {
      let math = t.substring(2);
      if (math.endsWith("$$")) {
        math = math.slice(0, -2);
      } else {
        // Collect lines until closing $$
        while (i + 1 < lines.length) {
          i++;
          const next = lines[i].trim();
          if (next.endsWith("$$")) {
            math += "\n" + next.slice(0, -2);
            break;
          }
          math += "\n" + next;
        }
      }
      elements.push(
        <div key={idx++} className="my-3 py-3 px-4 bg-muted/50 rounded-lg border border-border text-center overflow-x-auto">
          <MathText>{`$$${math.trim()}$$`}</MathText>
        </div>
      );
      continue;
    }

    // Numbered list: 1. or 1)
    const numMatch = t.match(/^(\d+)[.)]\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={idx++} className="flex gap-3 items-baseline pl-1 py-0.5">
          <span className="font-semibold text-primary min-w-[1.5rem] text-right shrink-0">{numMatch[1]}.</span>
          <span className="flex-1">{inlineMarkdown(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet: - text or • text
    const bulletMatch = t.match(/^[-•]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        <div key={idx++} className="flex gap-3 items-baseline pl-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-[0.4em]" />
          <span className="flex-1">{inlineMarkdown(bulletMatch[1])}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={idx++} className="py-0.5 leading-relaxed">{inlineMarkdown(t)}</p>);
  }

  return <div className="space-y-1">{elements}</div>;
}

/** Process inline markdown: **bold**, *italic*, and LaTeX $...$ */
function inlineMarkdown(text: string): React.ReactNode {
  // Process bold and italic first, then pass through MathText for LaTeX
  const segments: React.ReactNode[] = [];
  // Split on **bold** and *italic* patterns
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      segments.push(<MathText key={`t${lastIndex}`}>{before}</MathText>);
    }
    if (match[2]) {
      // Bold
      segments.push(<strong key={`b${match.index}`}><MathText>{match[2]}</MathText></strong>);
    } else if (match[3]) {
      // Italic
      segments.push(<em key={`i${match.index}`}><MathText>{match[3]}</MathText></em>);
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    segments.push(<MathText key={`r${lastIndex}`}>{rest}</MathText>);
  }

  if (segments.length === 0) {
    return <MathText>{text}</MathText>;
  }

  return <>{segments}</>;
}

export default function TeacherMaterialsArchive() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [materials, setMaterials] = useState<any[]>([]);
  const [adaptedMap, setAdaptedMap] = useState<Record<string, Record<string, any>>>({});
  const [classi, setClassi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create material dialog
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Preview dialog
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);
  type PreviewTab = "student" | "teacher" | "bes" | "dsa" | "h";
  const [previewVersion, setPreviewVersion] = useState<PreviewTab>("student");

  // Inline edit state for preview
  const [previewEditing, setPreviewEditing] = useState(false);
  const [previewEditContent, setPreviewEditContent] = useState("");
  const [previewEditSaving, setPreviewEditSaving] = useState(false);

  // Regeneration state
  const [regeneratingVersion, setRegeneratingVersion] = useState<string | null>(null);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);

  // Share dialog
  const [shareMaterial, setShareMaterial] = useState<any | null>(null);
  const [shareClassIds, setShareClassIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  // Reassign dialog
  const [reassignMaterial, setReassignMaterial] = useState<any | null>(null);
  const [reassignClassId, setReassignClassId] = useState("");
  const [reassignDest, setReassignDest] = useState<"all" | "selected" | "pdf">("all");
  const [reassignStudents, setReassignStudents] = useState<string[]>([]);
  const [reassignStudentsList, setReassignStudentsList] = useState<any[]>([]);
  const [reassignDueDate, setReassignDueDate] = useState<Date | undefined>(undefined);
  const [reassigning, setReassigning] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Edit dialog
  const [editMaterial, setEditMaterial] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subject: "", type: "", level: "", content: "" });
  const [saving, setSaving] = useState(false);

  // Adapted generation state
  const [generatingAdaptedFor, setGeneratingAdaptedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [matRes, classRes] = await Promise.all([
      supabase.from("teacher_materials").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("classi").select("id, nome").order("nome"),
    ]);
    const allMats = matRes.data || [];

    // Separate parent materials from adapted children
    const parents: any[] = [];
    const adaptedByParent: Record<string, Record<string, any>> = {};
    allMats.forEach((m: any) => {
      if (m.target_profile && ["bes", "dsa", "h"].includes(m.target_profile) && m.parent_material_id) {
        if (!adaptedByParent[m.parent_material_id]) adaptedByParent[m.parent_material_id] = {};
        adaptedByParent[m.parent_material_id][m.target_profile] = m;
      } else if (m.target_profile !== "docente") {
        // Exclude legacy "docente" target_profile records too
        parents.push(m);
      }
    });

    setMaterials(parents);
    setAdaptedMap(adaptedByParent);
    setClassi(classRes.data || []);
    setLoading(false);
  }

  const classMap = useMemo(() => {
    const m: Record<string, string> = {};
    classi.forEach(c => { m[c.id] = c.nome; });
    return m;
  }, [classi]);

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (classFilter !== "all" && m.class_id !== classFilter) return false;
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (statusFilter === "all" && m.status === "archived") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const title = (m.title || "").toLowerCase();
        const subject = (m.subject || "").toLowerCase();
        const type = (m.type || "").toLowerCase();
        return title.includes(q) || subject.includes(q) || type.includes(q);
      }
      return true;
    });
  }, [materials, classFilter, typeFilter, statusFilter, searchQuery]);

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
      const content = isTeacherVersion ? (m.content || "") : studentContent;

      renderAndPrintPdf(content, {
        title: m.title,
        type: m.type || "esercizi",
        subject: [m.subject, m.level ? "Livello: " + m.level : ""].filter(Boolean).join(" · "),
        className,
        date: dateStr,
        isTeacherOnly: isTeacherVersion,
      });
    } else {
      const isTeacherOnly = m.target_profile === "docente";
      renderAndPrintPdf(m.content || "", {
        title: m.title,
        type: m.type || "esercizi",
        subject: [m.subject, m.level ? "Livello: " + m.level : ""].filter(Boolean).join(" · "),
        className,
        date: dateStr,
        isTeacherOnly,
      });
    }
  }

  function handleDownloadAdaptedPdf(adaptedMat: any, version: "BES" | "DSA" | "H") {
    const className = adaptedMat.class_id && classMap[adaptedMat.class_id] ? classMap[adaptedMat.class_id] : "";
    const dateStr = new Date(adaptedMat.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    renderAndPrintPdf(adaptedMat.content || "", {
      title: adaptedMat.title,
      type: adaptedMat.type || "esercizi",
      subject: [adaptedMat.subject, adaptedMat.level ? "Livello: " + adaptedMat.level : ""].filter(Boolean).join(" · "),
      className,
      date: dateStr,
      adaptedVersion: version,
    });
  }

  async function generateAdaptedForMaterial(m: any) {
    setGeneratingAdaptedFor(m.id);
    try {
      const { studentContent } = splitTeacherContent(m.content || "");
      const systemPrompt = `You are an Italian special education specialist. Starting from the attached educational material, generate three separate adapted versions. Each version must cover the same topic and learning objectives as the original but adapted as follows:

BES (Bisogni Educativi Speciali): Simplify language and instructions. Use shorter sentences. Break complex tasks into smaller steps.

DSA (Disturbi Specifici dell'Apprendimento): Further simplify written instructions. Use numbered lists. Avoid copying tasks. Suggest compensatory tools. Use clear visual spacing.

H (Disabilità certificata — obiettivi minimi): Reduce to core essential concepts. Very simple language. Maximum 3-4 tasks. Include visual support suggestions.

Return only the three versions separated exactly by ===BES===, ===DSA===, ===H=== on their own lines. Write in Italian.`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            stream: false,
            maxTokens: 6000,
            systemPrompt,
            messages: [{ role: "user", content: `MATERIALE ORIGINALE:\n---\n${studentContent}\n---` }],
          }),
        }
      );
      const data = await res.json();
      const output = data.choices?.[0]?.message?.content?.trim() || "";
      if (!output) throw new Error("Empty response");

      const besMatch = output.split(/===\s*BES\s*===/i);
      const afterBes = besMatch.length > 1 ? besMatch.slice(1).join("===BES===") : "";
      const dsaParts = afterBes.split(/===\s*DSA\s*===/i);
      const besContent = dsaParts[0]?.trim() || null;
      const afterDsa = dsaParts.length > 1 ? dsaParts.slice(1).join("===DSA===") : "";
      const hParts = afterDsa.split(/===\s*H\s*===/i);
      const dsaContent = hParts[0]?.trim() || null;
      const hContent = hParts.length > 1 ? hParts.slice(1).join("===H===").trim() : null;

      if (!besContent && !dsaContent && !hContent) throw new Error("Parse failed");

      const versions: { key: string; content: string | null }[] = [
        { key: "bes", content: besContent },
        { key: "dsa", content: dsaContent },
        { key: "h", content: hContent },
      ];
      const inserts = versions
        .filter(v => v.content)
        .map(v => ({
          teacher_id: user!.id,
          class_id: m.class_id,
          title: `${m.title} — ${v.key.toUpperCase()}`,
          subject: m.subject,
          type: m.type,
          content: v.content!,
          target_profile: v.key,
          parent_material_id: m.id,
          is_sample: m.is_sample || false,
          status: "draft",
        }));
      if (inserts.length > 0) {
        await supabase.from("teacher_materials").insert(inserts);
      }
      toast.success("Versioni BES/DSA/H generate e salvate!");
      loadData();
    } catch (err) {
      console.error("Adapted generation failed:", err);
      toast.error("Errore nella generazione delle versioni adattate");
    } finally {
      setGeneratingAdaptedFor(null);
    }
  }
  /** Save inline edit for a specific version */
  async function handlePreviewEditSave() {
    if (!previewMaterial) return;
    setPreviewEditSaving(true);
    try {
      if (previewVersion === "student" || previewVersion === "teacher") {
        // Editing the parent material
        const hasSolutions = (previewMaterial.content || "").includes("===SOLUZIONI===");
        let newContent: string;
        if (previewVersion === "student" && hasSolutions) {
          const { teacherContent } = splitTeacherContent(previewMaterial.content || "");
          newContent = teacherContent
            ? `${previewEditContent}\n\n===SOLUZIONI===\n\n${teacherContent}`
            : previewEditContent;
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

        // If student version was edited, prompt to regenerate adapted versions
        if (previewVersion === "student") {
          const adapted = adaptedMap[previewMaterial.id];
          if (adapted && Object.keys(adapted).length > 0) {
            setShowRegenPrompt(true);
          }
        }
      } else {
        // Editing an adapted version (bes/dsa/h)
        const adapted = adaptedMap[previewMaterial.id];
        const adaptedMat = adapted?.[previewVersion];
        if (adaptedMat) {
          await supabase.from("teacher_materials").update({ content: previewEditContent, updated_at: new Date().toISOString() }).eq("id", adaptedMat.id);
          setAdaptedMap(prev => ({
            ...prev,
            [previewMaterial.id]: {
              ...prev[previewMaterial.id],
              [previewVersion]: { ...adaptedMat, content: previewEditContent },
            },
          }));
          toast.success("Versione adattata aggiornata");
        }
      }
    } catch (err) {
      toast.error("Errore nel salvataggio");
    }
    setPreviewEditSaving(false);
    setPreviewEditing(false);
  }

  /** Regenerate a single adapted version */
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

      // Update or insert in DB
      const adapted = adaptedMap[materialId];
      const existing = adapted?.[version];
      if (existing) {
        await supabase.from("teacher_materials").update({ content: output, updated_at: new Date().toISOString() }).eq("id", existing.id);
        setAdaptedMap(prev => ({
          ...prev,
          [materialId]: { ...prev[materialId], [version]: { ...existing, content: output } },
        }));
      } else {
        const { data: inserted } = await supabase.from("teacher_materials").insert({
          teacher_id: user!.id, class_id: mat.class_id, title: `${mat.title} — ${version.toUpperCase()}`,
          subject: mat.subject, type: mat.type, content: output, target_profile: version,
          parent_material_id: materialId, is_sample: mat.is_sample || false, status: "draft",
        }).select("*").single();
        if (inserted) {
          setAdaptedMap(prev => ({
            ...prev,
            [materialId]: { ...(prev[materialId] || {}), [version]: inserted },
          }));
        }
      }
      toast.success(`Versione ${version.toUpperCase()} rigenerata`);
    } catch (err) {
      toast.error("Errore nella rigenerazione");
    } finally {
      setRegeneratingVersion(null);
    }
  }

  /** Regenerate all adapted versions after student content edit */
  async function regenerateAllAdapted(materialId: string) {
    setShowRegenPrompt(false);
    for (const v of ["bes", "dsa", "h"] as const) {
      await regenerateSingleVersion(materialId, v);
    }
  }

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  /** Delete a material and its adapted versions (with double confirmation) */
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

  function openEdit(m: any) {
    setEditMaterial(m);
    setEditForm({
      title: m.title || "",
      subject: m.subject || "",
      type: m.type || "",
      level: m.level || "",
      content: (m.content || "").replace(/\\n/g, "\n"),
    });
  }

  async function handleSaveEdit() {
    if (!editMaterial) return;
    setSaving(true);
    const { error } = await supabase.from("teacher_materials").update({
      title: editForm.title,
      subject: editForm.subject,
      type: editForm.type,
      level: editForm.level,
      content: editForm.content,
      updated_at: new Date().toISOString(),
    }).eq("id", editMaterial.id);
    setSaving(false);
    if (error) { toast.error("Errore nel salvataggio"); return; }
    setMaterials(prev => prev.map(m => m.id === editMaterial.id ? { ...m, ...editForm, updated_at: new Date().toISOString() } : m));
    toast.success("Materiale aggiornato");
    setEditMaterial(null);
    // Also refresh the preview if open
    if (previewMaterial?.id === editMaterial.id) {
      setPreviewMaterial({ ...previewMaterial, ...editForm });
    }
  }

  function handleCreateConfirm() {
    if (!selectedClassId) return;
    setShowClassPicker(false);
    navigate(`/classe/${selectedClassId}?tab=materiali&create=true`);
    setSelectedClassId("");
  }

  function openShare(m: any) {
    setShareMaterial(m);
    setShareClassIds([]);
  }

  async function handleShare() {
    if (!shareMaterial || shareClassIds.length === 0 || !user) return;
    setSharing(true);
    const inserts = shareClassIds.map(classId => ({
      teacher_id: user.id,
      class_id: classId,
      title: shareMaterial.title,
      subject: shareMaterial.subject,
      type: shareMaterial.type,
      level: shareMaterial.level,
      content: shareMaterial.content,
      status: "draft" as const,
      target_profile: shareMaterial.target_profile,
    }));

    const { error } = await supabase.from("teacher_materials").insert(inserts);
    setSharing(false);
    if (error) { toast.error("Errore nella condivisione"); return; }
    toast.success(`Materiale condiviso con ${shareClassIds.length} ${shareClassIds.length === 1 ? "classe" : "classi"}`);
    setShareMaterial(null);
    loadData();
  }

  function toggleShareClass(id: string) {
    setShareClassIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  // Reassign functions
  async function openReassign(m: any) {
    setReassignMaterial(m);
    setReassignClassId("");
    setReassignDest("all");
    setReassignStudents([]);
    setReassignStudentsList([]);
    setReassignDueDate(undefined);
  }

  async function loadClassStudents(classId: string) {
    setLoadingStudents(true);
    const { data } = await supabase
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId);
    if (data && data.length > 0) {
      const ids = data.map(d => d.student_id);
      const { data: profiles } = await supabase
        .from("child_profiles")
        .select("id, name")
        .in("id", ids);
      setReassignStudentsList(profiles || []);
    } else {
      setReassignStudentsList([]);
    }
    setLoadingStudents(false);
  }

  async function handleReassign() {
    if (!reassignMaterial || !reassignClassId || !user) return;

    if (reassignDest === "pdf") {
      handleDownloadPdf(reassignMaterial);
      setReassignMaterial(null);
      return;
    }

    setReassigning(true);
    try {
      const targetStudents = reassignDest === "all"
        ? reassignStudentsList
        : reassignStudentsList.filter(s => reassignStudents.includes(s.id));

      if (targetStudents.length === 0) {
        toast.error("Nessuno studente selezionato");
        setReassigning(false);
        return;
      }

      const inserts = targetStudents.map(s => ({
        teacher_id: user.id,
        class_id: reassignClassId,
        student_id: s.id,
        title: reassignMaterial.title,
        type: reassignMaterial.type || "esercizi",
        subject: reassignMaterial.subject || null,
        description: reassignMaterial.content,
        due_date: reassignDueDate ? reassignDueDate.toISOString() : null,
        metadata: { reassigned: true },
      }));

      const { error } = await supabase.from("teacher_assignments").insert(inserts);
      if (error) throw error;

      await supabase.from("teacher_materials").update({
        status: "assigned",
        assigned_at: new Date().toISOString(),
      }).eq("id", reassignMaterial.id);

      toast.success(`Assegnato a ${targetStudents.length} studenti`);
      setReassignMaterial(null);
      loadData();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Riprova"));
    }
    setReassigning(false);
  }

  // Available classes to share to (exclude the material's current class)
  const shareableClasses = useMemo(() => {
    if (!shareMaterial) return classi;
    return classi.filter(c => c.id !== shareMaterial.class_id);
  }, [classi, shareMaterial]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">I miei materiali</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tutto quello che hai creato — pronto da riutilizzare, riassegnare o stampare.
              </p>
            </div>
            <Button onClick={() => setShowClassPicker(true)} size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Crea materiale
            </Button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca per titolo, materia o tipo..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs rounded-xl">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le classi</SelectItem>
                {classi.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-xl">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(t => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-xl">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pt-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-foreground">
              {materials.length === 0
                ? "Non hai ancora creato nessun materiale."
                : "Nessun materiale corrisponde alla ricerca."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {materials.length === 0 ? "Inizia adesso." : "Prova con un termine diverso."}
            </p>
            {materials.length === 0 && (
              <Button onClick={() => setShowClassPicker(true)} className="mt-4">
                <Plus className="w-4 h-4 mr-1" /> Crea materiale
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m, i) => (
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs gap-1.5"
                    onClick={() => handleArchive(m.id, m.status)}
                  >
                    {m.status === "archived" ? (
                      <><Undo2 className="w-3.5 h-3.5" /> Ripristina</>
                    ) : (
                      <><Archive className="w-3.5 h-3.5" /> Archivia</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => { setDeleteTarget(m); setDeleteStep(1); setDeleteConfirmText(""); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Elimina
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview dialog ── */}
      <Dialog open={!!previewMaterial} onOpenChange={open => {
        if (!open) {
          setPreviewMaterial(null);
          setPreviewVersion("student");
          setPreviewEditing(false);
          setShowRegenPrompt(false);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewMaterial && (() => {
            const hasSolutions = (previewMaterial.content || "").includes("===SOLUZIONI===");
            const { studentContent, teacherContent } = hasSolutions
              ? splitTeacherContent(previewMaterial.content || "")
              : { studentContent: previewMaterial.content || "", teacherContent: null };

            const adapted = adaptedMap[previewMaterial.id] || {};
            const hasAdapted = Object.keys(adapted).length > 0;

            // Determine content for current tab
            let displayContent = "";
            if (previewVersion === "student") displayContent = studentContent;
            else if (previewVersion === "teacher") displayContent = teacherContent || studentContent;
            else if (adapted[previewVersion]) displayContent = adapted[previewVersion].content || "";

            const isAdaptedTab = ["bes", "dsa", "h"].includes(previewVersion);
            const adaptedExists = isAdaptedTab && adapted[previewVersion];
            const isRegenerating = regeneratingVersion === previewVersion;

            // Tab definitions
            const tabs: { key: PreviewTab; emoji: string; label: string; show: boolean }[] = [
              { key: "student", emoji: "📄", label: "Studente", show: true },
              { key: "teacher", emoji: "🔒", label: "Docente", show: hasSolutions },
              { key: "bes", emoji: "🟡", label: "BES", show: true },
              { key: "dsa", emoji: "🔵", label: "DSA", show: true },
              { key: "h", emoji: "🟢", label: "H", show: true },
            ];

            return (
              <>
                {/* Header */}
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3">
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
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 px-2" onClick={() => { setDeleteTarget(previewMaterial); setDeleteStep(1); setDeleteConfirmText(""); }}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                {/* Version toggle bar */}
                <div className="flex items-center gap-1 mt-3 p-1 bg-muted rounded-lg overflow-x-auto">
                  {tabs.filter(t => t.show).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setPreviewVersion(tab.key); setPreviewEditing(false); }}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                        previewVersion === tab.key
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab.emoji} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Per-version action bar */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {!previewEditing ? (
                    <>
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                        onClick={() => {
                          setPreviewEditing(true);
                          setPreviewEditContent(displayContent);
                        }}
                        disabled={isAdaptedTab && !adaptedExists}
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Modifica
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                        onClick={() => {
                          if (previewVersion === "student") handleDownloadPdf(previewMaterial, hasSolutions ? "student" : "full");
                          else if (previewVersion === "teacher") handleDownloadPdf(previewMaterial, "teacher");
                          else if (adaptedExists) handleDownloadAdaptedPdf(adapted[previewVersion], previewVersion.toUpperCase() as "BES" | "DSA" | "H");
                        }}
                        disabled={isAdaptedTab && !adaptedExists}
                      >
                        <Download className="w-3 h-3 mr-1" /> Scarica PDF
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                        onClick={() => openShare(previewMaterial)}
                      >
                        <Share2 className="w-3 h-3 mr-1" /> Condividi
                      </Button>
                      {isAdaptedTab && (
                        <Button
                          variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                          disabled={isRegenerating}
                          onClick={() => regenerateSingleVersion(previewMaterial.id, previewVersion as "bes" | "dsa" | "h")}
                        >
                          {isRegenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                          {adaptedExists ? "Rigenera" : "Genera"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-7 text-xs rounded-lg" disabled={previewEditSaving} onClick={handlePreviewEditSave}>
                        {previewEditSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Salva
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setPreviewEditing(false)}>
                        Annulla
                      </Button>
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
                    <p className="text-sm text-muted-foreground mb-3">
                      Versione {previewVersion.toUpperCase()} non ancora generata
                    </p>
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
                    <Textarea
                      value={previewEditContent}
                      onChange={e => setPreviewEditContent(e.target.value)}
                      className="min-h-[300px] font-mono text-xs"
                    />
                  </div>
                ) : (
                  <div className="mt-2 bg-muted/30 border border-border rounded-xl p-5">
                    <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed">
                      {formatMaterialContent(displayContent)}
                    </div>
                  </div>
                )}

                {/* Regen prompt after student edit */}
                {showRegenPrompt && (
                  <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Hai modificato il materiale base. Vuoi rigenerare le versioni BES, DSA e H?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => regenerateAllAdapted(previewMaterial.id)}>
                        Sì, rigenera
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowRegenPrompt(false)}>
                        No, mantieni le versioni esistenti
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* ── Share dialog ── */}
      <Dialog open={!!shareMaterial} onOpenChange={open => !open && setShareMaterial(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Condividi con altre classi</DialogTitle>
            <DialogDescription>
              Seleziona le classi a cui vuoi assegnare una copia di "{shareMaterial?.title}".
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2 max-h-60 overflow-y-auto">
            {shareableClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun'altra classe disponibile.</p>
            ) : (
              shareableClasses.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={shareClassIds.includes(c.id)}
                    onCheckedChange={() => toggleShareClass(c.id)}
                  />
                  <span className="text-sm font-medium text-foreground">{c.nome}</span>
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareMaterial(null)}>Annulla</Button>
            <Button
              disabled={shareClassIds.length === 0 || sharing}
              onClick={handleShare}
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
              Condividi ({shareClassIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Class picker for create ── */}
      <Dialog open={showClassPicker} onOpenChange={setShowClassPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleziona la classe</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium">Classe</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Scegli una classe..." />
              </SelectTrigger>
              <SelectContent>
                {classi.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassPicker(false)}>Annulla</Button>
            <Button disabled={!selectedClassId} onClick={handleCreateConfirm}>Continua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editMaterial} onOpenChange={open => !open && setEditMaterial(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica materiale</DialogTitle>
            <DialogDescription>Aggiorna i dettagli e il contenuto del materiale.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Titolo</Label>
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Materia</Label>
                <Input
                  value={editForm.subject}
                  onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Tipo</Label>
                <Select value={editForm.type} onValueChange={v => setEditForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.filter(t => t.key !== "all").map(t => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Livello</Label>
                <Select value={editForm.level} onValueChange={v => setEditForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="intermedio">Intermedio</SelectItem>
                    <SelectItem value="avanzato">Avanzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Contenuto</Label>
              <Textarea
                value={editForm.content}
                onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                className="mt-1 min-h-[250px] font-mono text-xs"
                placeholder="Contenuto del materiale (supporta markdown)..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMaterial(null)}>Annulla</Button>
            <Button disabled={saving || !editForm.title || !editForm.content} onClick={handleSaveEdit}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reassign dialog ── */}
      <Dialog open={!!reassignMaterial} onOpenChange={open => !open && setReassignMaterial(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riassegna materiale</DialogTitle>
            <DialogDescription>
              Assegna "{reassignMaterial?.title}" agli studenti di una classe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Class select */}
            <div>
              <Label className="text-xs font-medium">Classe</Label>
              <Select
                value={reassignClassId}
                onValueChange={v => {
                  setReassignClassId(v);
                  setReassignStudents([]);
                  loadClassStudents(v);
                }}
              >
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Seleziona una classe..." /></SelectTrigger>
                <SelectContent>
                  {classi.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destination */}
            {reassignClassId && (
              <div>
                <Label className="text-xs font-medium mb-2 block">Destinazione</Label>
                <RadioGroup value={reassignDest} onValueChange={v => setReassignDest(v as any)} className="flex gap-2 flex-wrap">
                  {([
                    { value: "all", label: "Tutta la classe" },
                    { value: "selected", label: "Studenti specifici" },
                    { value: "pdf", label: "Scarica PDF" },
                  ] as const).map(({ value, label }) => (
                    <label
                      key={value}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-medium",
                        reassignDest === value
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/20"
                      )}
                    >
                      <RadioGroupItem value={value} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </RadioGroup>

                {reassignDest === "selected" && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 space-y-1 mt-2">
                    {loadingStudents ? (
                      <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    ) : reassignStudentsList.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Nessuno studente iscritto</p>
                    ) : reassignStudentsList.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={reassignStudents.includes(s.id)}
                          onCheckedChange={v => setReassignStudents(prev => v ? [...prev, s.id] : prev.filter(x => x !== s.id))}
                        />
                        <span className="text-sm">{s.name || "Studente"}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Due date */}
            {reassignClassId && reassignDest !== "pdf" && (
              <div>
                <Label className="text-xs font-medium">Scadenza (opzionale)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 rounded-xl justify-start text-left font-normal", !reassignDueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reassignDueDate ? format(reassignDueDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={reassignDueDate} onSelect={setReassignDueDate}
                      disabled={(date) => date < new Date()}
                      initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignMaterial(null)}>Annulla</Button>
            <Button
              disabled={!reassignClassId || reassigning || (reassignDest === "selected" && reassignStudents.length === 0)}
              onClick={handleReassign}
            >
              {reassigning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
              {reassignDest === "pdf" ? "Scarica PDF" : "Assegna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog (double step) ── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteStep(1); setDeleteConfirmText(""); } }}>
        <DialogContent className="sm:max-w-md">
          {deleteStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Eliminare materiale?</DialogTitle>
                <DialogDescription>
                  Vuoi eliminare "{deleteTarget?.title}"? Verranno eliminate anche tutte le versioni BES, DSA e H associate.
                </DialogDescription>
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
                <DialogDescription>
                  Questa azione è irreversibile. Digita il titolo del materiale per confermare.
                </DialogDescription>
              </DialogHeader>
              <div className="py-3">
                <Input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteTarget?.title || ""}
                  className="text-sm"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(1); setDeleteConfirmText(""); }}>Annulla</Button>
                <Button
                  variant="destructive"
                  disabled={deleteConfirmText !== (deleteTarget?.title || "")}
                  onClick={() => deleteTarget && executeDelete(deleteTarget.id)}
                >
                  Elimina definitivamente
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
