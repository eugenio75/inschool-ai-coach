import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emailTemplates } from "@/lib/emailTemplates";
import { toast } from "sonner";

export default function AdminEmailPreview() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(emailTemplates[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const active = emailTemplates.find((t) => t.id === activeId)!;

  const handleCopy = (id: string, html: string) => {
    navigator.clipboard.writeText(html);
    setCopied(id);
    toast.success("HTML copiato negli appunti!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Mail className="w-5 h-5 text-primary" />
          <h1 className="font-display text-lg font-semibold text-foreground">Email Templates Preview</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {emailTemplates.map((t) => (
            <Button
              key={t.id}
              variant={activeId === t.id ? "default" : "outline"}
              onClick={() => setActiveId(t.id)}
              className="rounded-xl text-sm"
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Anteprima</span>
            </div>
            <div className="p-4">
              <iframe
                srcDoc={active.html
                  .replace("{{ .ConfirmationURL }}", "#")
                  .replace("{{ .SiteURL }}", "https://inschool.azarlabs.com")}
                className="w-full border-0 rounded-lg"
                style={{ height: 600 }}
                title="Email preview"
              />
            </div>
          </div>

          {/* HTML Source */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">HTML Source</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(active.id, active.html)}
                className="rounded-lg text-xs gap-1.5"
              >
                {copied === active.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === active.id ? "Copiato!" : "Copia HTML"}
              </Button>
            </div>
            <div className="p-4 overflow-auto" style={{ maxHeight: 600 }}>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {active.html}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Come usare:</strong> Copia l'HTML di ogni template e incollalo nella dashboard del backend sotto
            Authentication → Email Templates. Usa le variabili Supabase: <code className="text-primary">{"{{ .ConfirmationURL }}"}</code> per il link di azione.
          </p>
        </div>
      </div>
    </div>
  );
}
