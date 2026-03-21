import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Brain, Sparkles, Heart, Shield, Timer,
  RefreshCw, Link2, Lock, Layers, BookOpen, GraduationCap, BookMarked,
  Users, Check, Menu, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getActiveChildProfileId } from "@/lib/database";
import {
  Sheet, SheetContent, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";

/* ── animation helpers ── */
const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };
const stagger = (i: number) => ({ ...fadeUp, transition: { duration: 0.5, delay: i * 0.08 } });

/* ── palette constants (inline, no custom CSS needed) ── */
const navy = "#1A3A5C";
const accent = "#0070C0";
const textMain = "#0F172A";
const textSub = "#64748B";
const sectionAlt = "#F8FAFC";
const borderClr = "#E2E8F0";
const green = "#22C55E";

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (isChildSession()) {
      navigate("/dashboard", { replace: true });
    } else if (user) {
      const profileId = getActiveChildProfileId();
      navigate(profileId ? "/dashboard" : "/profiles", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ color: textMain, fontFamily: "inherit" }}>

      {/* ═══ 1. NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm" style={{ borderBottom: `1px solid ${borderClr}` }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold tracking-tight" style={{ color: navy }}>InSchool</span>
            <span className="text-[10px] font-medium mt-1" style={{ color: textSub }}>by AzarLabs</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-5">
            <button onClick={() => navigate("/verify")} className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70" style={{ color: textSub }}>
              <BadgeCheck className="w-4 h-4" /> Verifica Credenziali
            </button>
            <Button variant="outline" className="rounded-full h-9 px-5 text-sm font-semibold" style={{ borderColor: borderClr, color: textMain }} onClick={() => navigate("/auth")}>
              Accedi
            </Button>
            <Button className="rounded-full h-9 px-5 text-sm font-semibold text-white" style={{ background: accent }} onClick={() => navigate("/auth")}>
              Inizia gratis <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="p-2"><Menu className="w-5 h-5" style={{ color: textMain }} /></button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-white pt-12 w-72">
                <div className="flex flex-col gap-4">
                  <SheetClose asChild>
                    <button onClick={() => navigate("/verify")} className="flex items-center gap-2 text-sm font-medium py-2" style={{ color: textMain }}>
                      <BadgeCheck className="w-4 h-4" /> Verifica Credenziali
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="outline" className="rounded-full justify-center" onClick={() => navigate("/auth")}>Accedi</Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button className="rounded-full justify-center text-white" style={{ background: accent }} onClick={() => navigate("/auth")}>Inizia gratis</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* ═══ 2. HERO ═══ */}
      <section className="pt-28 pb-20 md:pt-36 md:pb-28 px-5 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left column */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            {/* Badge pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-8" style={{ border: `1px solid ${borderClr}`, color: textSub }}>
              Tassonomia di Bloom · Metodo Socratico · EU AI Act Compliant
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight mb-6" style={{ color: navy }}>
              Il Coach AI che insegna<br />a ragionare.<br />
              <span style={{ color: accent }}>Non a rispondere.</span>
            </h1>

            <p className="text-base md:text-lg leading-relaxed mb-8 max-w-lg" style={{ color: textSub }}>
              L'unica piattaforma educativa AI con profilo cognitivo adattivo,
              sistema di benessere integrato e credenziali verificabili on-chain.
              Per studenti dalla primaria all'università — e per i loro docenti.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Button className="rounded-full h-12 px-7 text-sm font-bold text-white" style={{ background: accent }} onClick={() => navigate("/auth")}>
                Inizia gratis <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="outline" className="rounded-full h-12 px-7 text-sm font-semibold" style={{ borderColor: borderClr, color: textMain }} onClick={() => navigate("/verify")}>
                Verifica una credenziale
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium" style={{ color: textSub }}>
              {["Conforme EU AI Act 2026", "Protezione minori certificata", "Dati mai venduti"].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" style={{ color: green }} />{t}</span>
              ))}
            </div>
          </motion.div>

          {/* Right column — chat simulation card */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <div className="rounded-2xl p-6 md:p-8 relative" style={{ border: `1px solid ${borderClr}`, boxShadow: "0 8px 30px -10px rgba(0,0,0,0.08)" }}>
              <div className="absolute top-4 left-6 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: green }} />
                <span className="text-xs font-semibold" style={{ color: navy }}>Coach Marco</span>
              </div>
              <div className="mt-8 space-y-5 text-sm leading-relaxed" style={{ color: textMain }}>
                <div className="rounded-xl p-4" style={{ background: sectionAlt }}>
                  <p className="font-medium" style={{ color: navy }}>Coach Marco</p>
                  <p className="mt-1" style={{ color: textSub }}>"L'ultima volta ti eri fermato sulle equazioni di 2° grado. Cosa ricordi del discriminante?"</p>
                </div>
                <div className="rounded-xl p-4 ml-8" style={{ background: "white", border: `1px solid ${borderClr}` }}>
                  <p className="font-medium" style={{ color: navy }}>Studente</p>
                  <p className="mt-1" style={{ color: textSub }}>"Ehm... serve per capire quante soluzioni ha l'equazione?"</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: sectionAlt }}>
                  <p className="font-medium" style={{ color: navy }}>Coach Marco</p>
                  <p className="mt-1" style={{ color: textSub }}>"Esatto. E come lo calcoli? Parti dalla formula — cosa noti?"</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${accent}15`, color: accent }}>Bloom L4 · Analizzare</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 3. SOCIAL PROOF BAR ═══ */}
      <section style={{ background: sectionAlt, borderTop: `1px solid ${borderClr}`, borderBottom: `1px solid ${borderClr}` }} className="py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { big: "6", sub: "Livelli Bloom" },
            { big: "4", sub: "Profili età" },
            { big: "On-Chain", sub: "Credenziali" },
            { big: "EU AI Act", sub: "Conforme" },
            { big: "PFA", sub: "Protezione Minori" },
          ].map((m, i) => (
            <motion.div key={i} {...stagger(i)} className="flex items-baseline gap-2 text-center">
              <span className="text-xl font-bold" style={{ color: navy }}>{m.big}</span>
              <span className="text-xs font-medium" style={{ color: textSub }}>{m.sub}</span>
              {i < 4 && <span className="hidden md:block ml-8 text-xs" style={{ color: borderClr }}>|</span>}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ 4. EU AI ACT ═══ */}
      <section className="py-20 md:py-28 px-5" style={{ background: `linear-gradient(135deg, ${navy}, ${accent})` }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <motion.div {...fadeUp}>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-6 bg-red-500/20 text-red-200">Scadenza: 2 Agosto 2026</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-6">
              Il tuo AI scolastico è<br />conforme all'EU AI Act?
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Il Regolamento UE sull'Intelligenza Artificiale classifica i sistemi AI usati in educazione come <strong className="text-white">SISTEMI AD ALTO RISCHIO</strong> (Annex III). La deadline per la piena conformità è il 2 agosto 2026. Le sanzioni per non conformità arrivano fino a €15 milioni o il 3% del fatturato globale.
            </p>
            <p className="text-white font-semibold leading-relaxed mb-6">
              InSchool è l'unica piattaforma educativa italiana progettata con governance blockchain nativa per soddisfare queste obbligazioni dal primo giorno.
            </p>
            <button className="text-white/90 underline underline-offset-4 text-sm font-medium hover:text-white transition-colors">
              Scopri come siamo conformi <ChevronRight className="inline w-3.5 h-3.5" />
            </button>
          </motion.div>

          <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
            <div className="rounded-2xl p-6 md:p-8" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <h3 className="text-white font-bold text-lg mb-5">Obbligazioni EU AI Act — come le soddisfiamo</h3>
              <ul className="space-y-3">
                {[
                  "Sistema di gestione del rischio documentato",
                  "Governance dei dati certificata on-chain",
                  "Logging immutabile delle sessioni AI",
                  "Trasparenza verso studenti e famiglie",
                  "Supervisione umana garantita",
                  "Audit trail automatico e verificabile",
                  "Documentazione tecnica per le autorità",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-white/80">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: green }} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-white/40 mt-5">Conforme anche alla Legge italiana n. 132/2025 (in vigore dal 10 ottobre 2025)</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 5. COME FUNZIONA ═══ */}
      <section className="py-20 md:py-28 px-5 bg-white">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <motion.h2 {...fadeUp} className="text-3xl md:text-4xl font-bold" style={{ color: navy }}>Come funziona InSchool</motion.h2>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10">
          {[
            { num: "01", icon: Brain, title: "Il Coach impara da te", desc: "Ogni sessione costruisce un profilo unico: stile, ritmo, materie deboli, orario migliore." },
            { num: "02", icon: Sparkles, title: "Si adatta a te", desc: "Il profilo cognitivo dinamico anticipa dove ti blocchi e calibra il livello di sfida prima che il problema emerga." },
            { num: "03", icon: BadgeCheck, title: "Certifica i tuoi progressi", desc: "Le competenze raggiunte diventano credenziali NFT verificabili da scuole, università e aziende." },
          ].map((s, i) => (
            <motion.div key={i} {...stagger(i)} className="text-center">
              <span className="text-5xl font-bold" style={{ color: `${accent}30` }}>{s.num}</span>
              <div className="w-14 h-14 rounded-2xl mx-auto mt-4 mb-5 flex items-center justify-center" style={{ background: `${accent}10` }}>
                <s.icon className="w-7 h-7" style={{ color: accent }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: navy }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: textSub }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ 6. BENTO GRID ═══ */}
      <section className="py-20 md:py-28 px-5" style={{ background: sectionAlt }}>
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: navy }}>Tutto quello che ti serve, in un'unica piattaforma</h2>
            <p style={{ color: textSub }}>Cognitivo. Emotivo. Certificato.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Row 1 */}
            <BentoCard cols={6} icon={Brain} title="AI Coach Socratico" desc="Non dà mai la risposta. Fa sempre la domanda giusta. Metodo Socratico + Tassonomia di Bloom in ogni interazione." i={0} />
            <BentoCard cols={3} icon={Layers} title="6 Livelli Bloom" desc="Da Descrivere a Ragionare. Ogni sessione lavora sul livello cognitivo giusto per te." i={1} />
            <BentoCard cols={3} icon={Heart} title="Benessere Emotivo" desc="Check-in giornaliero adattivo. Protocollo PFA integrato. Il coach vede anche come stai." i={2} />

            {/* Row 2 */}
            <BentoCard cols={4} icon={Sparkles} title="Profilo Cognitivo Dinamico" desc="L'AI costruisce invisibilmente il tuo profilo: stile di apprendimento, punti di blocco, orario migliore, velocità di progressione." bg={`${accent}08`} i={3} />
            <BentoCard cols={4} icon={BadgeCheck} title="Credenziali On-Chain" desc="Soulbound Token (ERC-5192). Le tue competenze, certificate su blockchain privata. Verificabili da chiunque, immutabili per sempre." i={4} />
            <BentoCard cols={4} icon={Shield} title="Conformità EU AI Act" desc="Governance AI certificata. Logging immutabile. Audit trail automatico. Conforme alla deadline del 2 agosto 2026." bg={`${navy}08`} i={5} />

            {/* Row 3 */}
            <BentoCard cols={3} icon={Timer} title="Timer Focus" desc="Pomodoro, Deep Work, Ultra Focus. Con tracking materia." i={6} />
            <BentoCard cols={3} icon={RefreshCw} title="Memoria Attiva" desc="Spaced repetition. Curva dell'oblio gestita dall'AI." i={7} />
            <BentoCard cols={3} icon={Link2} title="Verifica Pubblica" desc="Aziende e università verificano le tue credenziali in un click. Senza login." i={8} />
            <BentoCard cols={3} icon={Lock} title="Protezione Minori" desc="Consenso genitoriale on-chain. GDPR nativo. Nessun dato personale sulla blockchain." i={9} />
          </div>
        </div>
      </section>

      {/* ═══ 7. PERCORSI PER ETÀ ═══ */}
      <section className="py-20 md:py-28 px-5 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: navy }}>Un coach per ogni fase del percorso formativo</h2>
            <p style={{ color: textSub }}>La stessa filosofia educativa, adattata alla tua età e ai tuoi obiettivi.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                badge: "6 — 13 anni", title: "Alunno", icon: Users, role: "alunno",
                desc: "Metodo socratico adattivo con analogie dai tuoi interessi. Sistema di benessere con protocollo PFA.",
                features: ["Coach personalizzabile (nome + avatar)", "Analogie dai tuoi interessi", "Check-in emotivo giornaliero", "Gamification e badge"],
              },
              {
                badge: "14 — 19 anni", title: "Superiori", icon: BookOpen, role: "superiori",
                desc: "Profilo cognitivo adattivo. Sfide calibrate. Timer focus. Il coach che capisce dove ti blocchi — prima che accada.",
                features: ["Profilo cognitivo dinamico", "Timer Pomodoro / Deep Work", "Gestione task e scadenze", "Spazio ascolto sicuro"],
              },
              {
                badge: "Università", title: "Universitario", icon: GraduationCap, role: "universitario",
                desc: "Mentor AI alla pari. Ricerca profonda, gestione esami, credenziali on-chain verificabili da aziende e atenei.",
                features: ["Ricerca bibliografica AI", "Tunnel di Focus avanzato", "Credenziali Soulbound verificabili", "Gestione esami con countdown"],
              },
              {
                badge: "Docenti", title: "Docente", icon: BookMarked, role: "docente",
                desc: "Genera verifiche per livelli Bloom, monitora la classe, ricevi riconoscimento per il lavoro che fai davvero.",
                features: ["Generatore verifiche AI (Bloom-based)", "Cruscotto classe", "Statistiche apprendimento", "Spazio ascolto professionale"],
              },
            ].map((c, i) => (
              <motion.div key={c.role} {...stagger(i)} className="rounded-2xl p-6 flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1" style={{ background: "white", border: `1px solid ${borderClr}`, borderLeft: `4px solid ${accent}` }} onClick={() => navigate(`/auth?role=${c.role}`)}>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full self-start mb-4" style={{ background: `${accent}10`, color: accent }}>{c.badge}</span>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className="w-5 h-5" style={{ color: navy }} />
                  <h3 className="text-lg font-bold" style={{ color: navy }}>{c.title}</h3>
                </div>
                <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: textSub }}>{c.desc}</p>
                <ul className="space-y-2 mb-5">
                  {c.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs font-medium" style={{ color: textMain }}>
                      <Check className="w-3 h-3 shrink-0" style={{ color: green }} />{f}
                    </li>
                  ))}
                </ul>
                <button className="text-sm font-semibold flex items-center gap-1 transition-colors" style={{ color: accent }}>
                  Inizia <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. TABELLA COMPETITIVA ═══ */}
      <section className="py-20 md:py-28 px-5" style={{ background: sectionAlt }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fadeUp} className="text-3xl md:text-4xl font-bold mb-10 text-center" style={{ color: navy }}>Perché InSchool è diverso</motion.h2>

          <motion.div {...fadeUp} className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: textSub }} />
                  <th className="py-3 px-4 font-bold text-center rounded-t-xl" style={{ background: `${accent}10`, color: accent }}>InSchool</th>
                  <th className="py-3 px-4 font-medium text-center" style={{ color: textSub }}>Khanmigo</th>
                  <th className="py-3 px-4 font-medium text-center" style={{ color: textSub }}>Socratic</th>
                  <th className="py-3 px-4 font-medium text-center" style={{ color: textSub }}>ChatGPT</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "Non dà mai la risposta",
                  "Profilo cognitivo adattivo",
                  "Sistema benessere integrato",
                  "Credenziali verificabili",
                  "Conforme EU AI Act 2026",
                  "Protezione minori certificata",
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${borderClr}` }}>
                    <td className="py-3 px-4 font-medium" style={{ color: textMain }}>{row}</td>
                    <td className="py-3 px-4 text-center" style={{ background: `${accent}05` }}>
                      <Check className="w-4 h-4 mx-auto" style={{ color: green }} />
                    </td>
                    <td className="py-3 px-4 text-center"><X className="w-4 h-4 mx-auto" style={{ color: "#CBD5E1" }} /></td>
                    <td className="py-3 px-4 text-center"><X className="w-4 h-4 mx-auto" style={{ color: "#CBD5E1" }} /></td>
                    <td className="py-3 px-4 text-center"><X className="w-4 h-4 mx-auto" style={{ color: "#CBD5E1" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ═══ 9. CTA FINALE ═══ */}
      <section className="py-24 md:py-32 px-5 text-center" style={{ background: `linear-gradient(135deg, ${navy}, ${accent})` }}>
        <motion.div {...fadeUp} className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-6">
            Inizia oggi.<br />Il tuo coach ti aspetta.
          </h2>
          <p className="text-white/70 mb-10">Gratis. Nessuna carta di credito. Setup in 2 minuti.</p>
          <Button className="rounded-full h-14 px-10 text-base font-bold" style={{ background: "white", color: navy }} onClick={() => navigate("/auth")}>
            Crea il tuo account gratuito <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <p className="mt-5">
            <button onClick={() => navigate("/auth")} className="text-white/50 underline text-sm hover:text-white/80 transition-colors">Già registrato? Accedi</button>
          </p>
        </motion.div>
      </section>

      {/* ═══ 10. FOOTER ═══ */}
      <footer className="py-14 px-5 bg-white" style={{ borderTop: `1px solid ${borderClr}` }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <span className="text-lg font-bold" style={{ color: navy }}>InSchool</span>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: textSub }}>Il Coach AI che insegna a ragionare.</p>
            <p className="text-xs mt-3" style={{ color: textSub }}>AzarLabs — Divisione R&D di Tenks S.r.l.s. · Calabria, Italia</p>
          </div>
          {/* Prodotto */}
          <div>
            <h4 className="font-bold text-sm mb-3" style={{ color: navy }}>Prodotto</h4>
            <ul className="space-y-2 text-sm" style={{ color: textSub }}>
              <li><button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">Come funziona</button></li>
              <li><button onClick={() => navigate("/verify")} className="hover:underline flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Verifica Credenziali</button></li>
              <li><button onClick={() => navigate("/auth")} className="hover:underline">Inizia gratis</button></li>
            </ul>
          </div>
          {/* Legale */}
          <div>
            <h4 className="font-bold text-sm mb-3" style={{ color: navy }}>Legale</h4>
            <ul className="space-y-2 text-sm" style={{ color: textSub }}>
              <li><button onClick={() => navigate("/privacy")} className="hover:underline">Privacy Policy</button></li>
              <li><button onClick={() => navigate("/security")} className="hover:underline">Protezione Minori</button></li>
              <li><a href="#" className="hover:underline">EU AI Act Compliance</a></li>
              <li><span>contact@inschool.ai</span></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-6 text-center text-xs" style={{ borderTop: `1px solid ${borderClr}`, color: textSub }}>
          © 2026 InSchool · AzarLabs · Tenks S.r.l.s. — Tutti i diritti riservati
        </div>
      </footer>
    </div>
  );
};

/* ── Bento Card sub-component ── */
function BentoCard({ cols, icon: Icon, title, desc, bg, i }: { cols: number; icon: React.ElementType; title: string; desc: string; bg?: string; i: number }) {
  return (
    <motion.div
      {...stagger(i)}
      className={`md:col-span-${cols} rounded-2xl p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}
      style={{ background: bg || "white", border: `1px solid ${borderClr}` }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}10` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <h3 className="font-bold mb-1.5" style={{ color: navy }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: textSub }}>{desc}</p>
    </motion.div>
  );
}

export default Landing;
