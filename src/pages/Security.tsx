import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Security = () => {
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
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-8">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight mb-6">
            Protocollo Protezione Minori
          </h1>
          <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
            La sicurezza dei nostri studenti è la priorità assoluta di InSchool (powered by AzarLabs AI). 
            Abbiamo progettato la piattaforma da zero per garantire un ambiente accademico 100% protetto.
          </p>

          <div className="space-y-8">
            <section className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <h2 className="text-2xl font-bold flex items-center gap-3 mb-4 text-foreground">
                <Lock className="w-6 h-6 text-primary" />
                Intelligenza Artificiale "Recintata"
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Gli account "Alunno" (Elementari e Medie) non interagiscono con un'IA generica. L'IA di InSchool per i minori è severamente istruita a rifiutare qualsiasi deviazione dal percorso scolastico. Parolacce, discorsi inappropriati o richieste fuori tema vengono bloccati istantaneamente e deviati nuovamente verso lo studio.
              </p>
            </section>

            <section className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <h2 className="text-2xl font-bold flex items-center gap-3 mb-4 text-foreground">
                <Eye className="w-6 h-6 text-accent-foreground" />
                Monitoraggio Genitoriale
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Gli account dei minori non richiedono email o dati personali per l'accesso; utilizzano un "Codice Magico" univoco generato dal genitore. Il genitore, dal suo pannello di controllo, può monitorare il tempo di studio, le materie affrontate e i traguardi raggiunti.
              </p>
            </section>

            <section className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <h2 className="text-2xl font-bold flex items-center gap-3 mb-4 text-foreground">
                <FileText className="w-6 h-6 text-secondary-foreground" />
                Anonimizzazione dei Dati
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Le conversazioni tra InSchool AI e lo studente non vengono mai utilizzate per addestrare modelli di intelligenza artificiale per scopi commerciali. Le sessioni vengono anonimizzate ed elaborate esclusivamente per generare riassunti e statistiche didattiche all'interno dell'isolato ecosistema parentale.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Security;
