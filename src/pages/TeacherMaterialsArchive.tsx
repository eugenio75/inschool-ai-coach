import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, FolderOpen, FileText, Download, Pencil, Archive, Share2, Loader2, X, Eye } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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

export default function TeacherMaterialsArchive() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [materials, setMaterials] = useState<any[]>([]);
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

  // Share dialog
  const [shareMaterial, setShareMaterial] = useState<any | null>(null);
  const [shareClassIds, setShareClassIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

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
    setMaterials(matRes.data || []);
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
                    <Badge variant={statusVariant(m.status)} className="text-[10px]">{statusLabel(m.status)}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {m.class_id && classMap[m.class_id] && <span>{classMap[m.class_id]}</span>}
                    {m.subject && <span>{m.subject}</span>}
                    <span>{new Date(m.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openShare(m)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title="Condividi con altre classi"
                  >
                    <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Scarica PDF">
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Modifica">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleArchive(m.id, m.status)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title={m.status === "archived" ? "Ripristina" : "Archivia"}
                  >
                    <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview dialog ── */}
      <Dialog open={!!previewMaterial} onOpenChange={open => !open && setPreviewMaterial(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewMaterial && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{previewMaterial.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{typeLabel(previewMaterial.type)}</Badge>
                    {previewMaterial.subject && (
                      <Badge variant="secondary" className="text-[10px]">{previewMaterial.subject}</Badge>
                    )}
                    {previewMaterial.level && (
                      <Badge variant="secondary" className="text-[10px]">Livello: {previewMaterial.level}</Badge>
                    )}
                    {previewMaterial.class_id && classMap[previewMaterial.class_id] && (
                      <span className="text-[11px] text-muted-foreground">{classMap[previewMaterial.class_id]}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(previewMaterial.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 bg-muted/30 border border-border rounded-xl p-5">
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                  {previewMaterial.content}
                </div>
              </div>

              <DialogFooter className="mt-4 flex-row gap-2">
                <Button variant="outline" size="sm" onClick={() => openShare(previewMaterial)}>
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Condividi
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-3.5 h-3.5 mr-1" /> Scarica PDF
                </Button>
                <Button size="sm" onClick={() => setPreviewMaterial(null)}>Chiudi</Button>
              </DialogFooter>
            </>
          )}
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
    </div>
  );
}
