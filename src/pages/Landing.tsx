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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 relative overflow-x-hidden font-sans">
      {/* Dynamic Bright Backgrounds */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/10 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[60vw] bg-accent/10 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[40vw] bg-secondary/10 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/70 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Hexagon className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              InSchool
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:flex text-sm text-muted-foreground font-medium mr-4">Il futuro dello studio</span>
            <Button
              className="rounded-full px-6 transition-all duration-300"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm text-sm font-medium mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">L'Intelligenza Artificiale che rivoluziona lo studio</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.05] mb-8 text-foreground"
          >
            Impara, Cresci,<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-accent">
              Supera i tuoi limiti.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 flex-1 leading-relaxed"
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
                className="h-14 px-8 rounded-full font-bold text-lg shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.5)] transition-all"
             >
                Inizia Subito <ArrowRight className="ml-2 w-5 h-5" />
             </Button>
             <Button
                variant="outline"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-8 rounded-full font-medium text-lg shadow-sm"
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
                <motion.div key={i} variants={itemVariant} className="flex flex-col items-center text-center p-6 bg-card border border-border rounded-3xl shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <feature.icon className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-foreground mb-1">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </motion.div>
            ))}
        </motion.div>
      </section>

      {/* Elaborate Features Section */}
      <section id="features" className="py-32 px-6 relative z-10 bg-card border-y border-border">
         <div className="max-w-7xl mx-auto">
             <div className="mb-20 text-center">
                 <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">L'Ecosistema Accademico</h2>
                 <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Un ponte intelligente tra intuzioni umane e l'infinita conoscenza offerta da AzarLabs AI.</p>
             </div>
             
             <div className="grid md:grid-cols-3 gap-8">
                 <div className="bg-muted/50 border border-border p-8 rounded-[2.5rem] h-full shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8">
                        <Laptop className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-foreground">Piattaforma Multidispositivo</h3>
                    <p className="text-muted-foreground leading-relaxed">Accedi ai tuoi appunti e alle sfide del coach dal computer fisso a casa, dal tablet a scuola o dallo smartphone. Cloud sync istantaneo.</p>
                 </div>
                 
                 <div className="bg-muted/50 border border-border p-8 rounded-[2.5rem] h-full shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mb-8">
                        <BookMarked className="w-8 h-8 text-accent-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-foreground">Apprendimento Attivo</h3>
                    <p className="text-muted-foreground leading-relaxed">Il coach non fornisce semplici risposte, ma stimola la curiosità attraverso il metodo socratico, fissando i concetti in profondità.</p>
                 </div>

                 <div className="bg-muted/50 border border-border p-8 rounded-[2.5rem] h-full shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-8">
                        <LineChart className="w-8 h-8 text-secondary-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-foreground">Analitiche & Progressi</h3>
                    <p className="text-muted-foreground leading-relaxed">Analizza il tuo andamento scolastico, scopri le tue lacune e ricevi report dettagliati per preparare verifiche e sessioni universitarie.</p>
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
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">Scegli il tuo percorso</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
               InSchool adatta metriche, interfacce e governance dell'Intelligenza Artificiale al tuo identikit accademico.
            </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 - Bambini */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-card border border-border p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
                onClick={() => handleRoleSelect("alunno")}
            >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 text-primary">
                   <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Elementari e Medie</h3>
                <p className="text-muted-foreground text-sm mb-8 leading-relaxed flex-1">
                L'infrastruttura di sicurezza chiude l'IA in un perimetro controllato. Risposte dolci, rigorose e focalizzate 100% sullo studio. Naviga in totale sicurezza.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-foreground font-medium">
                    <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary"/> IA Blindata Genitori</li>
                    <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary"/> Gamification Inclusiva</li>
                </ul>
                <Button className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl font-bold transition-all shadow-none">
                Accesso Genitore <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>

            {/* Card 2 - Liceali */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-card border border-border p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
                onClick={() => handleRoleSelect("superiori")}
            >
                <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mb-8 text-accent-foreground">
                   <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Scuole Superiori</h3>
                <p className="text-muted-foreground text-sm mb-8 leading-relaxed flex-1">
                L'IA si trasforma in un tutor esigente. Ti interroga su concetti complessi di filososia o latino, e scompone argomenti mastodontici in sfide a scatti.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-foreground font-medium">
                    <li className="flex items-center gap-2"><Focus className="w-4 h-4 text-primary"/> Sfide a tempo (Pomodoro)</li>
                    <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/> Organizzazione task</li>
                </ul>
                <Button className="w-full bg-accent/20 text-accent-foreground hover:bg-primary hover:text-primary-foreground rounded-xl font-bold transition-all shadow-none">
                Inizia Superiori <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>

            {/* Card 3 - Università */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-card border border-border p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
                onClick={() => handleRoleSelect("universitario")}
            >
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-8 text-secondary-foreground">
                   <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Università</h3>
                <p className="text-muted-foreground text-sm mb-8 leading-relaxed flex-1">
                La sessione incombe. Usa l'assistente per sintesi profonda, ricerca bibliografica istantanea e interrogazioni in ambito STEM, Legale o Medico senza alcuna limitazione.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-foreground font-medium">
                    <li className="flex items-center gap-2"><Hexagon className="w-4 h-4 text-primary"/> IA Ricerca Profonda</li>
                    <li className="flex items-center gap-2"><LineChart className="w-4 h-4 text-primary"/> Tunnel di Focus</li>
                </ul>
                <Button className="w-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground rounded-xl font-bold transition-all shadow-none">
                Modalità Sessione <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>

            {/* Card 4 - Docenti */}
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full bg-card border border-border p-8 rounded-[2rem] flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
                onClick={() => handleRoleSelect("docente")}
            >
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-8 text-muted-foreground">
                   <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Docenti</h3>
                <p className="text-muted-foreground text-sm mb-8 leading-relaxed flex-1">
                Il tuo co-pilota didattico. Usa InSchool per generare bozze di verifiche, monitorare statistiche di apprendimento e assistere individualmente 30 ragazzi in simultanea.
                </p>
                <ul className="mb-8 space-y-3 text-sm text-foreground font-medium">
                    <li className="flex items-center gap-2"><Laptop className="w-4 h-4 text-primary"/> Cruscotto Classe</li>
                    <li className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Creator Test</li>
                </ul>
                <Button className="w-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-xl font-bold transition-all shadow-none">
                Area Docenti <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </motion.div>
            </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="py-12 border-t border-border bg-card relative z-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
                <Hexagon className="w-6 h-6 text-primary" fill="currentColor" opacity={0.1} />
                <span className="font-display font-bold text-xl text-foreground">InSchool</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs text-center md:text-left">
                Creando un'esperienza di studio radicalmente più accessibile, serena ed efficace.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground font-semibold">
            <span onClick={() => navigate("/privacy")} className="hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                Privacy Policy <Lock className="w-4 h-4"/>
            </span>
            <span onClick={() => navigate("/security")} className="hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                Protezione Minori <ShieldCheck className="w-4 h-4 text-primary"/>
            </span>
            <span className="hover:text-primary transition-colors cursor-default flex items-center gap-2">
                Powered by AzarLabs AI <Zap className="w-4 h-4 text-primary"/>
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-border text-center text-muted-foreground/60 text-xs font-medium">
            © 2026 AzarLabs HQ — Advanced Educational AI Protocol. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
