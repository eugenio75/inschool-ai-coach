import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Hexagon, GraduationCap, Users, BookOpen,
  ShieldCheck, Zap, Laptop, BookMarked,
  Clock, Award, Lock, Brain, Target, Layers, Mic,
  ChevronDown, Heart, Link2, BadgeCheck, Sparkles, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getActiveChildProfileId } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 200, damping: 30 };

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);

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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-body">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-2xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
              <Hexagon className="w-4.5 h-4.5 text-background" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">InSchool</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth" })}
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Percorsi
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Funzionalità
            </button>
            <Button
              variant="outline"
              className="rounded-full px-5 h-9 text-sm font-semibold border-border"
              onClick={() => navigate("/auth")}
            >
              Accedi
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 pt-20 pb-16"
      >
        {/* Grain texture overlay */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none z-0"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }}
        />

        {/* Gradient orbs — subtle and refined */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] left-[5%] w-[30vw] h-[30vw] max-w-[500px] max-h-[500px] bg-primary/8 dark:bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-[10%] right-[5%] w-[25vw] h-[25vw] max-w-[400px] max-h-[400px] bg-secondary/8 dark:bg-secondary/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/50 text-xs font-semibold text-muted-foreground mb-10 tracking-wide uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI Coach Educativo · Tassonomia di Bloom
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="font-display text-[clamp(2.5rem,8vw,6rem)] font-black leading-[1] tracking-[-0.04em] mb-8"
          >
            Il tuo studio,{" "}
            <span className="relative inline-block">
              <span className="relative z-10">potenziato.</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-[0.1em] left-0 right-0 h-[0.12em] bg-primary/30 dark:bg-primary/20 origin-left rounded-full -z-0"
              />
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.35 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed font-medium"
          >
            Un AI Coach che si adatta alla tua età, al tuo stile cognitivo e al tuo stato emotivo.
            <br className="hidden md:block" />
            Dalla primaria all'università — metodo socratico, profilo adattivo, credenziali verificabili.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth" })}
              className="h-13 px-8 rounded-full font-bold text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            >
              Scegli il tuo percorso <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="h-13 px-8 rounded-full font-medium text-base text-muted-foreground hover:text-foreground"
            >
              Come funziona
            </Button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <ChevronDown className="w-5 h-5 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ─── SOCIAL PROOF BAR ─── */}
      <section className="py-10 px-6 border-y border-border/50 bg-card/30 relative z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground">
          {[
            { num: "6", label: "Livelli Bloom integrati" },
            { num: "AI", label: "Profilo cognitivo adattivo" },
            { num: "100%", label: "Sicurezza minori" },
            { num: "24/7", label: "Coach disponibile" },
            { num: "On-chain", label: "Credenziali verificabili" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-baseline gap-2"
            >
              <span className="font-display text-2xl font-black text-foreground">{s.num}</span>
              <span className="text-sm font-medium">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── BENTO FEATURES ─── */}
      <section id="features" className="py-28 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Ecosistema</p>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight text-foreground">
              Tutto ciò che serve per studiare meglio.
            </h2>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Large card — AI Coach */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="md:col-span-4 bg-card border border-border rounded-3xl p-8 md:p-10 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-700" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-3">AI Coach Socratico</h3>
                <p className="text-muted-foreground max-w-md leading-relaxed">
                  Non ti dà le risposte — ti guida a trovarle. Basato sulla Tassonomia di Bloom,
                  il coach adatta ogni domanda al tuo livello cognitivo reale, sessione dopo sessione.
                </p>
              </div>
            </motion.div>

            {/* Small card — Focus */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8 flex flex-col justify-between"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Focus Timer</h3>
                <p className="text-sm text-muted-foreground">Pomodoro intelligente con coaching integrato durante lo studio.</p>
              </div>
            </motion.div>

            {/* Small card — Memory */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8 flex flex-col justify-between"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-6">
                <Layers className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Memoria Attiva</h3>
                <p className="text-sm text-muted-foreground">Ripasso adattivo basato sulla curva dell'oblio. L'AI ricorda ciò che tu dimentichi.</p>
              </div>
            </motion.div>

            {/* Medium card — Multi-device */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-6">
                <Laptop className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Multi-dispositivo</h3>
              <p className="text-sm text-muted-foreground">PC, tablet, smartphone. I tuoi progressi ovunque, sincronizzati in tempo reale.</p>
            </motion.div>

            {/* Card — Emotional Well-being */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                <Heart className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Benessere Emotivo</h3>
              <p className="text-sm text-muted-foreground">Check-in giornaliero adattivo con protocollo PFA. L'AI monitora il mood e interviene con sensibilità.</p>
            </motion.div>

            {/* Card — Blockchain Credentials */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <BadgeCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Credenziali On-Chain</h3>
              <p className="text-sm text-muted-foreground">Certificati Soulbound (ERC-5192) verificabili da chiunque. Le tue competenze, immutabili.</p>
            </motion.div>

            {/* Large card — Adaptive Profile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35 }}
              className="md:col-span-4 bg-card border border-border rounded-3xl p-8 md:p-10 relative overflow-hidden group"
            >
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 group-hover:bg-accent/10 transition-colors duration-700" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-6">
                  <Sparkles className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-3">Profilo Cognitivo Dinamico</h3>
                <p className="text-muted-foreground max-w-md leading-relaxed">
                  L'AI costruisce un profilo invisibile del tuo stile di apprendimento: velocità, punti di blocco, 
                  stile preferito, orario migliore. Ogni sessione diventa più precisa della precedente.
                </p>
              </div>
            </motion.div>

            {/* Card — Oral Prep */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                <Mic className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Interrogazione Orale</h3>
              <p className="text-sm text-muted-foreground">Simula l'interrogazione con l'AI. Preparati come dal vivo, con feedback specifico.</p>
            </motion.div>

            {/* Card — Analytics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.45 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Analytics Studio</h3>
              <p className="text-sm text-muted-foreground">Visualizza i tuoi progressi settimanali, streak di studio e distribuzione per materia.</p>
            </motion.div>

            {/* Card — Verify */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="md:col-span-2 bg-card border border-border rounded-3xl p-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-6">
                <Link2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Verifica Pubblica</h3>
              <p className="text-sm text-muted-foreground">Pagina pubblica per aziende e università: verifica credenziali singole o in blocco via CSV.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── ROLE SELECTION ─── */}
      <section id="roles" className="py-28 px-6 relative z-10 bg-card/30 border-y border-border/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Percorsi</p>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight text-foreground mb-4">
              Per ogni età, un'esperienza diversa.
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              L'AI si adatta al tuo livello scolastico: interfaccia, tono, complessità e governance cambiano automaticamente.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                role: "alunno",
                icon: Users,
                title: "Elementari & Medie",
                accent: "bg-primary/10 text-primary",
                btnClass: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
                btnLabel: "Accesso Genitore",
                features: [
                  { icon: ShieldCheck, text: "IA protetta e recintata" },
                  { icon: Award, text: "Gamification positiva" },
                  { icon: Heart, text: "Check-in emotivo giornaliero" },
                ],
                desc: "IA blindata e controllata dal genitore. Metodo socratico adattivo, sistema di benessere con protocollo PFA integrato.",
              },
              {
                role: "superiori",
                icon: BookOpen,
                title: "Scuole Superiori",
                accent: "bg-accent text-accent-foreground",
                btnClass: "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground",
                btnLabel: "Inizia Superiori",
                features: [
                  { icon: Target, text: "Timer Pomodoro / Deep Work" },
                  { icon: Clock, text: "Gestione task e scadenze" },
                  { icon: Sparkles, text: "Profilo cognitivo adattivo" },
                ],
                desc: "L'IA diventa un tutor che si adatta al tuo stile. Tassonomia di Bloom invisibile, sfide personalizzate.",
              },
              {
                role: "universitario",
                icon: GraduationCap,
                title: "Università",
                accent: "bg-secondary/20 text-secondary-foreground",
                btnClass: "bg-secondary/20 text-secondary-foreground hover:bg-primary hover:text-primary-foreground",
                btnLabel: "Modalità Sessione",
                features: [
                  { icon: Brain, text: "Ricerca bibliografica AI" },
                  { icon: Zap, text: "Tunnel di Focus avanzato" },
                  { icon: BadgeCheck, text: "Credenziali Soulbound" },
                ],
                desc: "Mentor AI alla pari. Ricerca profonda, gestione esami, credenziali on-chain verificabili.",
              },
              {
                role: "docente",
                icon: BookMarked,
                title: "Docenti",
                accent: "bg-muted text-muted-foreground",
                btnClass: "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
                btnLabel: "Area Docenti",
                features: [
                  { icon: Laptop, text: "Cruscotto classe" },
                  { icon: Layers, text: "Generatore verifiche" },
                ],
                desc: "Il tuo co-pilota didattico. Genera verifiche, monitora l'apprendimento e assisti 30 studenti in simultanea.",
              },
            ].map((card, i) => (
              <motion.div
                key={card.role}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...spring, delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                onClick={() => handleRoleSelect(card.role)}
                className="group relative bg-card border border-border rounded-3xl p-7 flex flex-col cursor-pointer hover:border-primary/30 hover:shadow-card transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl ${card.accent} flex items-center justify-center mb-6`}>
                  <card.icon className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{card.desc}</p>
                <ul className="space-y-2.5 mb-7">
                  {card.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <f.icon className="w-4 h-4 text-primary shrink-0" />
                      {f.text}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${card.btnClass}`}>
                  {card.btnLabel} <ArrowRight className="inline-block ml-1.5 w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="py-28 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight text-foreground mb-6">
            Inizia a studiare
            <br />
            <span className="text-primary">in modo diverso.</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Gratuito per iniziare. Nessuna carta di credito. Scegli il tuo percorso e lascia che l'AI faccia il resto.
          </p>
          <Button
            onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth" })}
            className="h-14 px-10 rounded-full font-bold text-lg shadow-lg shadow-primary/20"
          >
            Scegli il tuo percorso <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-12 border-t border-border bg-card/50 relative z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <Hexagon className="w-4 h-4 text-background" />
              </div>
              <span className="font-display font-bold text-foreground">InSchool</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground font-medium">
              <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Privacy
              </button>
              <button onClick={() => navigate("/security")} className="hover:text-foreground transition-colors flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Protezione Minori
              </button>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" /> AzarLabs AI
              </span>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border/50 text-center text-muted-foreground/50 text-xs">
            © 2026 AzarLabs HQ — All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
