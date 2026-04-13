import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  userId: string;
  students?: Array<{ id: string; name: string }>;
  assignments?: Array<{ id: string; title: string }>;
  defaultStudentName?: string;
  defaultStudentId?: string;
  defaultAssignmentId?: string;
  defaultAssignmentTitle?: string;
  onSaved?: () => void;
}

const SCALE_OPTIONS = [
  { value: "/10", label: "/10" },
  { value: "/30", label: "/30" },
  { value: "/100", label: "/100" },
  { value: "giudizio", label: "Giudizio" },
];

const GIUDIZIO_OPTIONS = ["Ottimo", "Buono", "Sufficiente", "Insufficiente"];

export default function ManualGradeModal({
  open, onOpenChange, classId, userId, students = [], assignments = [],
  defaultStudentName, defaultStudentId, defaultAssignmentId, defaultAssignmentTitle,
  onSaved,
}: Props) {
  const [studentName, setStudentName] = useState(defaultStudentName || "");
  const [studentId, setStudentId] = useState(defaultStudentId || "");
  const [assignmentId, setAssignmentId] = useState(defaultAssignmentId || "");
  const [assignmentTitle, setAssignmentTitle] = useState(defaultAssignmentTitle || "");
  const [grade, setGrade] = useState("");
  const [gradeScale, setGradeScale] = useState("/10");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function handleStudentSelect(val: string) {
    if (val === "__custom__") {
      setStudentId("");
      setStudentName("");
    } else {
      const s = students.find(s => s.id === val);
      setStudentId(val);
      setStudentName(s?.name || "");
    }
  }

  function handleAssignmentSelect(val: string) {
    if (val === "__custom__") {
      setAssignmentId("");
      setAssignmentTitle("");
    } else {
      const a = assignments.find(a => a.id === val);
      setAssignmentId(val);
      setAssignmentTitle(a?.title || "");
    }
  }

  async function handleSave() {
    if (!studentName.trim() || !grade.trim()) {
      toast.error("Inserisci almeno il nome dello studente e il voto.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("manual_grades").insert({
      teacher_id: userId,
      class_id: classId,
      student_name: studentName.trim(),
      student_id: studentId || null,
      assignment_id: assignmentId || null,
      assignment_title: assignmentTitle.trim() || null,
      grade: grade.trim(),
      grade_scale: gradeScale,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      console.error("Manual grade insert error:", error);
      toast.error("Errore nel salvataggio del voto.");
      return;
    }
    toast.success("Voto inserito!");
    onOpenChange(false);
    resetForm();
    onSaved?.();
  }

  function resetForm() {
    setStudentName(defaultStudentName || "");
    setStudentId(defaultStudentId || "");
    setAssignmentId(defaultAssignmentId || "");
    setAssignmentTitle(defaultAssignmentTitle || "");
    setGrade("");
    setGradeScale("/10");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>📝 Inserisci voto manuale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Student */}
          <div>
            <Label>Studente</Label>
            {students.length > 0 ? (
              <Select onValueChange={handleStudentSelect} defaultValue={defaultStudentId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Seleziona studente..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">✏️ Altro (inserisci nome)</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {(!studentId || students.length === 0) && (
              <Input
                placeholder="Nome studente"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="mt-1 rounded-xl"
              />
            )}
          </div>

          {/* Assignment */}
          <div>
            <Label>Attività</Label>
            {assignments.length > 0 ? (
              <Select onValueChange={handleAssignmentSelect} defaultValue={defaultAssignmentId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Seleziona attività..." />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">✏️ Altro (inserisci titolo)</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {(!assignmentId || assignments.length === 0) && (
              <Input
                placeholder="Titolo attività (es. Verifica frazioni)"
                value={assignmentTitle}
                onChange={e => setAssignmentTitle(e.target.value)}
                className="mt-1 rounded-xl"
              />
            )}
          </div>

          {/* Grade + Scale */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Voto</Label>
              {gradeScale === "giudizio" ? (
                <Select onValueChange={setGrade} value={grade}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue placeholder="Giudizio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GIUDIZIO_OPTIONS.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="es. 7.5"
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              )}
            </div>
            <div>
              <Label>Scala</Label>
              <Select onValueChange={(v) => { setGradeScale(v); setGrade(""); }} value={gradeScale}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCALE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Note (opzionale)</Label>
            <Textarea
              placeholder="Osservazioni..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 rounded-xl min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Annulla</Button>
          <Button onClick={handleSave} disabled={saving || !studentName.trim() || !grade.trim()} className="rounded-xl">
            {saving ? "Salvataggio..." : "Salva voto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
