import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, ArrowRight, Hexagon, GraduationCap, Users, BookOpen,
  Focus, LineChart, ShieldCheck, Zap, Laptop, BookMarked,
  Clock, Award, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getActiveChildProfileId } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariant = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: spring }
};

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (isChildSession()) {
      navigate("/dashboard", { replace: true });
    } else if (user) {
      const profileId = getActiveChildProfileId();
      navigate(profileId ? "/dashboard" : "/profiles", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleRoleSelect = (role: string) => {
    navigate(`/auth?role=${role}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-200 relative overflow-x-hidden font-sans">
      {/* Dynamic Bright Backgrounds */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-400/10 blur-[150px] rounded-full mix-blend-multiply" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[60vw] bg-purple-400/10 blur-[150px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[40vw] bg-emerald-400/10 blur-[150px] rounded-full mix-blend-multiply" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Hexagon className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              InSchool
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:flex text-sm text-slate-500 font-medium mr-4">Il futuro dello studio</span>
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-6 transition-all duration-300"
              onClick={() => navigate("/auth")}
            >
              Accedi
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 z-10 flex flex-col items-center justify-center min-h-[90vh] text-center">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium mb-8"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-slate-700">L'Intelligenza Artificiale che rivoluziona lo studio</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.05] mb-8 text-slate-900"
          >
            Impara, Cresci,<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              Supera i tuoi limiti.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-12 flex-1 leading-relaxed"
          >
            Il primo AI Coach educativo che si adatta alla tua età, al tuo stile di apprendimento e ai tuoi obiettivi accademici. Niente stress, solo puro apprendimento guidato.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
             <Button
                onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-bold text-lg shadow-[0_10px_40px_-10px_rgba(37,99,235,0.5)] transition-all"
             >
                Inizia Subito <ArrowRight className="ml-2 w-5 h-5" />
             </Button>
             <Button
                variant="outline"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-8 rounded-full border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-lg shadow-sm"
             >
                Scopri di più
             </Button>
          </motion.div>
        </div>

        {/* Feature Highlights directly in Hero */}
        <motion.div 
            initial="hidden" animate="show" variants={staggerContainer}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mt-24"
        >
            {[
                { icon: Hexagon, title: "AI Adattiva", desc: "Tutor accademico 24/7" },
                { icon: Focus, title: "Metodo di Studio", desc: "Neuro-apprendimento integrato" },
                { icon: ShieldCheck, title: "Sicurezza Minori", desc: "Rigore e protezione dati" },
                { icon: Zap, title: "Motivazione", desc: "Gamification positiva" }
            ].map((feature, i) => (
                <motion.div key={i} variants={itemVariant} className="flex flex-col items-center text-center p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-blue-600">
                        <feature.icon className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">{feature.title}</h4>
                    <p className="text-sm text-slate-500">{feature.desc}</p>
                </motion.div>
            ))}
        </motion.div>
      </section>

      {/* Elaborate Features Section */}
      <section id="features" className="py-32 px-6 relative z-10 bg-white border-y border-slate-200">
         <div className="max-w-7xl mx-auto">
             <div className="mb-20 text-center">
                 <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-slate-900">L'Ecosistema Accademico</h2>
                 <p className="text-xl text-slate-500 max-w-2xl mx-auto">Un ponte intelligente tra intuzioni umane e l'infinita conoscenza offerta da AzarLabs AI.</p>
             </div>
             
             <div className="grid md:grid-cols-3 gap-8">
                 <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] h-full shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-8">
                        <Laptop className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-slate-900">Piattaforma Multidispositivo</h3>
                    <p className="text-slate-600 leading-relaxed">Accedi ai tuoi appunti e alle sfide del coach dal computer fisso a casa, dal tablet a scuola o dallo smartphone. Cloud sync istantaneo.</p>
                 </div>
                 
                 <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] h-full shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-8">
                        <BookMarked className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-slate-900">Apprendimento Attivo</h3>
                    <p className="text-slate-600 leading-relaxed">Il coach non fornisce semplici risposte, ma stimola la curiosità attraverso il metodo socratico, fissando i concetti in profondità.</p>
                 </div>

                 <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] h-full shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-pink-100 flex items-center justify-center mb-8">
                        <LineChart className="w-8 h-8 text-pink-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-slate-900">Analitiche & Progressi</h3>
                    <p className="text-slate-600 leading-relaxed">Analizza il tuo andamento scolastico, scopri le tue lacune e ricevi report dettagliati per preparare verifiche e sessioni universitarie.</p>
                 </div>
             </div>
         </div>
      </section>

      {/* Role Selection Matrix */}
      <section id="roles" className="py-32 px-6 relative z-10 w-full">
        <div className="max-w-7xl mx-auto">
            <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
            >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-slate-900">Scegli il tuo percorso</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
               InSchool adatta metriche, interfacce e governance dell'Intelligenza Artificiale al tuo identikit accademico.
            </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 - Bambini */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-white border border-blue-100 p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.15)] transition-all"
                onClick={() => handleRoleSelect("alunno")}
            >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-8 text-blue-600">
                   <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-900">Elementari e Medie</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed flex-1">
                L'infrastruttura di sicurezza chiude l'IA in un perimetro controllato. Risposte dolci, rigorose e focalizzate 100% sullo studio. Naviga in totale sicurezza.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-500"/> IA Blindata Genitori</li>
                    <li className="flex items-center gap-2"><Award className="w-4 h-4 text-blue-500"/> Gamification Inclusiva</li>
                </ul>
                <Button className="w-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl font-bold transition-all shadow-none">
                Accesso Genitore <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>

            {/* Card 2 - Liceali */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-white border border-purple-100 p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.15)] transition-all"
                onClick={() => handleRoleSelect("superiori")}
            >
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-8 text-purple-600">
                   <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-900">Scuole Superiori</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed flex-1">
                L'IA si trasforma in un tutor esigente. Ti interroga su concetti complessi di filososia o latino, e scompone argomenti mastodontici in sfide a scatti.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex items-center gap-2"><Focus className="w-4 h-4 text-purple-500"/> Sfide a tempo (Pomodoro)</li>
                    <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-purple-500"/> Organizzazione task</li>
                </ul>
                <Button className="w-full bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white rounded-xl font-bold transition-all shadow-none">
                Inizia Superiori <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>

            {/* Card 3 - Università */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-white border border-indigo-100 p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.15)] transition-all"
                onClick={() => handleRoleSelect("universitario")}
            >
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-8 text-indigo-600">
                   <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-900">Università</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed flex-1">
                La sessione incombe. Usa l'assistente per sintesi profonda, ricerca bibliografica istantanea e interrogazioni in ambito STEM, Legale o Medico senza alcuna limitazione.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex items-center gap-2"><Hexagon className="w-4 h-4 text-indigo-500"/> IA Ricerca Profonda</li>
                    <li className="flex items-center gap-2"><LineChart className="w-4 h-4 text-indigo-500"/> Tunnel di Focus</li>
                </ul>
                <Button className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl font-bold transition-all shadow-none">
                Modalità Sessione <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>

            {/* Card 4 - Docenti */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-white border border-emerald-100 p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] transition-all"
                onClick={() => handleRoleSelect("docente")}
            >
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-8 text-emerald-600">
                   <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-900">Docenti</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed flex-1">
                Il tuo co-pilota didattico. Usa InSchool per generare bozze di verifiche, monitorare statistiche di apprendimento e assistere individualmente 30 ragazzi in simultanea.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex items-center gap-2"><Laptop className="w-4 h-4 text-emerald-500"/> Cruscotto Classe</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500"/> Creator Test</li>
                </ul>
                <Button className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl font-bold transition-all shadow-none">
                Area Docenti <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>
            </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white relative z-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
                <Hexagon className="w-6 h-6 text-blue-600" fill="currentColor" opacity={0.1} />
                <span className="font-display font-bold text-xl text-slate-900">InSchool</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs text-center md:text-left">
                Creando un'esperienza di studio radicalmente più accessibile, serena ed efficace.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-slate-600 font-semibold">
            <span onClick={() => navigate("/privacy")} className="hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-2">
                Privacy Policy <Lock className="w-4 h-4"/>
            </span>
            <span onClick={() => navigate("/security")} className="hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-2">
                Protezione Minori <ShieldCheck className="w-4 h-4 text-blue-500"/>
            </span>
            <span className="hover:text-blue-600 transition-colors cursor-default flex items-center gap-2">
                Powered by AzarLabs AI <Zap className="w-4 h-4 text-amber-500"/>
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-100 text-center text-slate-400 text-xs font-medium">
            © 2026 AzarLabs HQ — Advanced Educational AI Protocol. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
