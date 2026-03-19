import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Security = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Torna Indietro
          </Button>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-8">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 tracking-tight mb-6">
            Protocollo Protezione Minori
          </h1>
          <p className="text-xl text-slate-600 mb-12 leading-relaxed">
            La sicurezza dei nostri studenti è la priorità assoluta di InSchool (powered by AzarLabs AI). 
            Abbiamo progettato la piattaforma da zero per garantire un ambiente accademico 100% protetto.
          </p>

          <div className="space-y-8">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold flex items-center gap-3 mb-4 text-slate-800">
                <Lock className="w-6 h-6 text-blue-500" />
                Intelligenza Artificiale "Recintata"
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Gli account "Alunno" (Elementari e Medie) non interagiscono con un'IA generica. L'IA di InSchool per i minori è severamente istruita a rifiutare qualsiasi deviazione dal percorso scolastico. Parolacce, discorsi inappropriati o richieste fuori tema vengono bloccati istantaneamente e deviati nuovamente verso lo studio.
              </p>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold flex items-center gap-3 mb-4 text-slate-800">
                <Eye className="w-6 h-6 text-emerald-500" />
                Monitoraggio Genitoriale
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Gli account dei minori non richiedono email o dati personali per l'accesso; utilizzano un "Codice Magico" univoco generato dal genitore. Il genitore, dal suo pannello di controllo, può monitorare il tempo di studio, le materie affrontate e i traguardi raggiunti.
              </p>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold flex items-center gap-3 mb-4 text-slate-800">
                <FileText className="w-6 h-6 text-purple-500" />
                Anonimizzazione dei Dati
              </h2>
              <p className="text-slate-600 leading-relaxed">
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
