import { motion } from "framer-motion";
import { ArrowLeft, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Torna Indietro
          </Button>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="w-16 h-16 bg-muted text-muted-foreground rounded-2xl flex items-center justify-center mb-8">
            <Scale className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight mb-6">
            Informativa sulla Privacy
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            Ultimo aggiornamento: Marzo 2026. AzarLabs HQ
          </p>

          <div className="prose prose-neutral dark:prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary">
            <h3>1. Informativa generale</h3>
            <p>
              Benvenuto in InSchool. Questa informativa sulla privacy descrive come AzarLabs ("Noi", "Nostro") raccoglie, utilizza e condivide le tue informazioni
              personali durante l'utilizzo del nostro sito web o dei nostri servizi (l'"Ecosistema").
            </p>

            <h3>2. Dati che raccogliamo</h3>
            <p>
              Noi raccogliamo dati personali limitati e primariamente finalizzati a fornire l'esperienza educativa. 
              Questo include nome, età, località, informazioni scolastiche e cronologia delle conversazioni e degli apprendimenti per mezzo con la nostra AzarLabs AI.
            </p>

            <h3>3. Piattaforme di terze parti (GPT / OpenAI)</h3>
            <p>
              Le interrogazioni generate all'interno dell'app vengono elaborate da modelli di intelligenza artificiale avanzati. Nessun PII (Personal Identifiable Information) degli account minori viene inviato consciamente nei payload delle LLM APIs.
            </p>

            <h3>4. Diritti dell'utente</h3>
            <p>
              Hai il diritto di accedere, rettificare o cancellare le tue informazioni personali in qualsiasi momento contattando privacy@azarlabs.com. I genitori possono eliminare in forma definitiva l'account "alunno" dal proprio pannello.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Privacy;
