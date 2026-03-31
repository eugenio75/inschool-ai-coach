import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, FolderOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import SharedMaterialsList from "@/components/teacher/SharedMaterialsList";

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

    const parents: any[] = [];
    const adaptedByParent: Record<string, Record<string, any>> = {};
    allMats.forEach((m: any) => {
      if (m.target_profile && ["bes", "dsa", "h"].includes(m.target_profile) && m.parent_material_id) {
        if (!adaptedByParent[m.parent_material_id]) adaptedByParent[m.parent_material_id] = {};
        adaptedByParent[m.parent_material_id][m.target_profile] = m;
      } else if (m.target_profile !== "docente") {
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

  function handleCreateConfirm() {
    if (!selectedClassId) return;
    setShowClassPicker(false);
    navigate(`/classe/${selectedClassId}?tab=materiali&create=true`);
    setSelectedClassId("");
  }

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
          <SharedMaterialsList
            materials={filtered}
            setMaterials={setMaterials}
            adaptedMap={adaptedMap}
            setAdaptedMap={setAdaptedMap}
            classMap={classMap}
            classi={classi}
            userId={user!.id}
            onReload={loadData}
          />
        )}
      </div>

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
