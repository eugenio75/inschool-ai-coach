import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, BookOpen, FileText, Brain, Layers, Search,
  Loader2, Play, Star, Plus, Upload, Image, File, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { subjectColors } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type MaterialType = "concept" | "flashcard" | "session" | "pdf" | "image" | "slide" | "appunti" | "traccia";

interface MaterialItem {
  id: string;
  type: MaterialType;
  title: string;
  subject: string;
  content: string;
  created_at: string;
  strength?: number;
  source_id?: string;
  file_url?: string;
  isFavorite?: boolean;
}

const SUBJECTS_LIST = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia",
  "Inglese", "Arte", "Musica", "Tecnologia", "Filosofia",
  "Fisica", "Chimica", "Latino", "Greco", "Diritto", "Economia",
];

const UPLOAD_TYPES_ADVANCED = [
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Immagine" },
  { value: "slide", label: "Slide" },
  { value: "appunti", label: "Appunti" },
  { value: "traccia", label: "Traccia d'esame" },
];

export default function MaterialLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId || "";
  const schoolLevel = session?.profile?.school_level || "";

  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("pdf");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  // Resume study dialog
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [resumeItem, setResumeItem] = useState<MaterialItem | null>(null);

  // Access check for elementari
  const [libraryEnabled, setLibraryEnabled] = useState<boolean | null>(null);

  const isElementari = schoolLevel === "alunno";
  const isMedie = schoolLevel === "medie";
  const isAdvanced = ["superiori", "universitario"].includes(schoolLevel);

  useEffect(() => {
    if (isElementari) {
      checkLibraryAccess();
    } else {
      setLibraryEnabled(true);
    }
  }, [schoolLevel, profileId]);

  useEffect(() => {
    if (libraryEnabled) {
      loadMaterials();
      if (isAdvanced) loadFavorites();
    }
  }, [user, profileId, libraryEnabled]);

  async function checkLibraryAccess() {
    const { data } = await supabase
      .from("user_preferences")
      .select("data")
      .eq("profile_id", profileId)
      .maybeSingle();
    const prefs = (data?.data as any) || {};
    if (!prefs.show_library) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setLibraryEnabled(true);
  }

  async function loadFavorites() {
    const { data } = await supabase
      .from("material_favorites")
      .select("material_id")
      .eq("profile_id", profileId);
    if (data) {
      setFavoriteIds(new Set(data.map((f: any) => f.material_id)));
    }
  }

  async function toggleFavorite(item: MaterialItem) {
    const isFav = favoriteIds.has(item.id);
    if (isFav) {
      await supabase.from("material_favorites").delete()
        .eq("profile_id", profileId)
        .eq("material_id", item.id);
      setFavoriteIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } else {
      await supabase.from("material_favorites").insert({
        profile_id: profileId,
        material_id: item.id,
        material_type: item.type,
      } as any);
      setFavoriteIds(prev => new Set(prev).add(item.id));
    }
  }

  async function loadMaterials() {
    setLoading(true);
    const allItems: MaterialItem[] = [];

    // Load memory_items (concepts/schemas) — all profiles
    const { data: concepts } = await supabase
      .from("memory_items")
      .select("*")
      .eq("child_profile_id", profileId)
      .order("created_at", { ascending: false });

    if (concepts) {
      for (const c of concepts) {
        allItems.push({
          id: c.id, type: "concept", title: c.concept, subject: c.subject,
          content: c.summary || "", created_at: c.created_at,
          strength: c.strength || 50,
        });
      }
    }

    // Load flashcards — medie+
    if (!isElementari && user) {
      const { data: cards } = await supabase
        .from("flashcards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cards) {
        const bySubject: Record<string, any[]> = {};
        for (const c of cards) {
          if (!bySubject[c.subject]) bySubject[c.subject] = [];
          bySubject[c.subject].push(c);
        }
        for (const [subject, group] of Object.entries(bySubject)) {
          allItems.push({
            id: `flashcard-${subject}`, type: "flashcard",
            title: `Flashcard di ${subject}`, subject,
            content: `${group.length} carte`, created_at: group[0].created_at,
          });
        }
      }
    }

    // Load completed guided sessions — medie+
    if (!isElementari && user) {
      const { data: sessions } = await supabase
        .from("guided_sessions")
        .select("*, homework_tasks(title, subject)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20);

      if (sessions) {
        for (const s of sessions) {
          const hw = (s as any).homework_tasks;
          if (hw) {
            allItems.push({
              id: s.id, type: "session", title: hw.title, subject: hw.subject,
              content: `Completata — Livello Bloom ${s.bloom_level_reached || "?"}`,
              created_at: s.completed_at || s.started_at || "",
              source_id: s.homework_id || undefined,
            });
          }
        }
      }
    }

    // Load student_materials — superiori/università only
    if (isAdvanced) {
      const { data: mats } = await supabase
        .from("student_materials")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (mats) {
        for (const m of mats as any[]) {
          allItems.push({
            id: m.id, type: m.material_type as MaterialType,
            title: m.title, subject: m.subject,
            content: m.file_name, created_at: m.created_at,
            file_url: m.file_url,
          });
        }
      }
    }

    setItems(allItems);
    setLoading(false);
  }

  async function handleUpload() {
    if (!uploadFile || !uploadSubject || !uploadTitle) {
      toast.error("Compila tutti i campi");
      return;
    }
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop() || "bin";
      const path = `${profileId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("student-materials")
        .upload(path, uploadFile);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("student-materials")
        .getPublicUrl(path);

      await supabase.from("student_materials").insert({
        profile_id: profileId,
        file_url: urlData.publicUrl,
        file_name: uploadFile.name,
        file_type: ext,
        material_type: isMedie ? "image" : uploadType,
        subject: uploadSubject,
        title: uploadTitle,
      } as any);

      toast.success("Materiale aggiunto!");
      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadSubject("");
      loadMaterials();
    } catch (e: any) {
      toast.error(e.message || "Errore nel caricamento");
    }
    setUploading(false);
  }

  const subjects = useMemo(() => {
    const s = new Set(items.map(i => i.subject));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (showFavoritesOnly && !favoriteIds.has(i.id)) return false;
      if (subjectFilter !== "all" && i.subject !== subjectFilter) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return i.title.toLowerCase().includes(q) || i.subject.toLowerCase().includes(q) || i.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, subjectFilter, typeFilter, searchQuery, showFavoritesOnly, favoriteIds]);

  const typeIcon = (type: MaterialType) => {
    switch (type) {
      case "concept": return <Brain className="w-4 h-4" />;
      case "flashcard": return <Layers className="w-4 h-4" />;
      case "session": return <FileText className="w-4 h-4" />;
      case "pdf": case "appunti": case "traccia": return <File className="w-4 h-4" />;
      case "image": return <Image className="w-4 h-4" />;
      case "slide": return <Layers className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const typeLabel = (type: MaterialType) => {
    const labels: Record<string, string> = {
      concept: isElementari ? "Schema" : "Concetto",
      flashcard: "Flashcard", session: "Sessione",
      pdf: "PDF", image: "Foto", slide: "Slide",
      appunti: "Appunti", traccia: "Traccia",
    };
    return labels[type] || type;
  };

  const handleResumeStudy = (item: MaterialItem) => {
    if (isMedie) {
      // Direct resume — guided review
      if (item.type === "concept") navigate("/memory");
      else if (item.type === "flashcard") navigate("/flashcards");
      else if (item.source_id) navigate(`/homework/${item.source_id}`);
      else navigate("/memory");
    } else if (isAdvanced) {
      setResumeItem(item);
      setShowResumeDialog(true);
    } else {
      // elementari — simple navigate
      navigate("/memory");
    }
  };

  const handleResumeOption = (option: string) => {
    if (!resumeItem) return;
    setShowResumeDialog(false);
    switch (option) {
      case "coach":
        if (resumeItem.source_id) navigate(`/homework/${resumeItem.source_id}`);
        else navigate("/study");
        break;
      case "flashcard":
        navigate("/flashcards");
        break;
      case "prep":
        navigate(`/prep/${resumeItem.subject}`);
        break;
    }
  };

  // Type filter options based on profile
  const typeFilterOptions = useMemo(() => {
    const base = [
      { key: "all", label: "Tutti" },
      { key: "concept", label: isElementari ? "Schemi" : "Concetti" },
    ];
    if (!isElementari) {
      base.push({ key: "flashcard", label: "Flashcard" });
      base.push({ key: "session", label: "Sessioni" });
    }
    if (isAdvanced) {
      base.push({ key: "pdf", label: "PDF" });
      base.push({ key: "slide", label: "Slide" });
      base.push({ key: "appunti", label: "Appunti" });
      base.push({ key: "traccia", label: "Tracce" });
    }
    if (isMedie) {
      base.push({ key: "image", label: "Foto" });
    }
    return base;
  }, [isElementari, isMedie, isAdvanced]);

  const emptyMessage = isElementari
    ? "Non ci sono ancora materiali. Continua a studiare!"
    : isMedie
    ? "I tuoi schemi e le tue sintesi appariranno qui dopo ogni sessione."
    : "Carica i tuoi materiali o completa una sessione per iniziare la tua libreria.";

  if (libraryEnabled === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border px-6 pt-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Libreria Materiali</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            {isElementari ? "I tuoi schemi" : "I tuoi materiali"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isElementari ? "Gli schemi che hai creato studiando"
              : isMedie ? "Schemi, mappe e sintesi delle tue sessioni"
              : "Tutti i tuoi materiali di studio in un unico posto"}
          </p>

          {/* Search — medie+ (superiori/univ get full text search) */}
          {!isElementari && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca nei materiali..."
                className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <div className="flex gap-1 bg-muted/30 rounded-xl p-1 flex-wrap">
              {typeFilterOptions.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTypeFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Favorites filter — superiori/università only */}
            {isAdvanced && (
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                  showFavoritesOnly ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-muted text-muted-foreground"
                }`}
              >
                <Star className="w-3 h-3" /> Preferiti
              </button>
            )}
          </div>

          {/* Subject pills */}
          {subjects.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSubjectFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  subjectFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                Tutte le materie
              </button>
              {subjects.map(s => {
                const colors = subjectColors[s] || subjectColors.Matematica;
                return (
                  <button key={s} onClick={() => setSubjectFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                      subjectFilter === s ? `${colors.bg} ${colors.text}` : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-5 pb-6">
        {/* Upload button — medie (foto only), superiori/univ (full) */}
        {(isMedie || isAdvanced) && (
          <Button onClick={() => setShowUpload(true)} variant="outline" className="w-full rounded-2xl mb-4 border-dashed border-2">
            <Plus className="w-4 h-4 mr-2" />
            {isMedie ? "+ Aggiungi foto" : "+ Aggiungi materiale"}
          </Button>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {items.length === 0 ? emptyMessage : "Nessun risultato"}
            </p>
            {items.length > 0 && (
              <p className="text-muted-foreground text-sm mt-1">Prova a modificare i filtri</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => {
              const colors = subjectColors[item.subject] || subjectColors.Matematica;
              const isFav = favoriteIds.has(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 hover:shadow-md transition-shadow"
                >
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={colors.text}>{typeIcon(item.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{typeLabel(item.type)}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className={`text-[10px] font-semibold ${colors.text}`}>{item.subject}</span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm truncate">{item.title}</h3>
                    {item.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.content}</p>
                    )}
                    {item.strength !== undefined && !isElementari && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-24">
                          <div
                            className={`h-full rounded-full ${item.strength >= 70 ? "bg-primary" : item.strength >= 40 ? "bg-secondary" : "bg-destructive"}`}
                            style={{ width: `${item.strength}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{item.strength}%</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Favorite button — superiori/univ */}
                    {isAdvanced && (
                      <button onClick={() => toggleFavorite(item)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Star className={`w-4 h-4 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      </button>
                    )}
                    {/* Resume study button */}
                    <button
                      onClick={() => handleResumeStudy(item)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors group"
                      title="Riprendi studio"
                    >
                      <Play className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isMedie ? "Aggiungi foto" : "Aggiungi materiale"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Titolo</Label>
              <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Nome del materiale" className="mt-1 rounded-xl" />
            </div>
            {isAdvanced && (
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UPLOAD_TYPES_ADVANCED.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Materia</Label>
              <Select value={uploadSubject} onValueChange={setUploadSubject}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Seleziona materia" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS_LIST.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">File</Label>
              <div className="mt-1 border-2 border-dashed border-border rounded-xl p-4 text-center">
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <File className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground truncate">{uploadFile.name}</span>
                    <button onClick={() => setUploadFile(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {isMedie ? "Tocca per caricare una foto" : "Tocca per caricare un file"}
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept={isMedie ? "image/*" : "image/*,.pdf,.ppt,.pptx,.doc,.docx,.txt"}
                      onChange={e => {
                        if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadSubject || !uploadTitle} className="w-full rounded-xl">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {uploading ? "Caricamento..." : "Carica"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume Study Dialog — superiori/università */}
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Riprendi studio</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Cosa vuoi fare con <span className="font-semibold text-foreground">{resumeItem?.title}</span>?
          </p>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => handleResumeOption("coach")}>
              <Brain className="w-4 h-4 mr-2 text-primary" /> Ripassa con il coach
            </Button>
            <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => handleResumeOption("flashcard")}>
              <Layers className="w-4 h-4 mr-2 text-primary" /> Crea flashcard
            </Button>
            <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => handleResumeOption("prep")}>
              <FileText className="w-4 h-4 mr-2 text-primary" /> Prepara interrogazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
