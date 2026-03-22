import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Brain, Sparkles, Shield, Check,
  Menu, ChevronRight, BookOpen, GraduationCap, BookMarked, Users,
} from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/button";
import { isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getActiveChildProfileId } from "@/lib/database";
import {
  Sheet, SheetContent, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };
const stagger = (i: number) => ({ ...fadeUp, transition: { duration: 0.5, delay: i * 0.08 } });

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLang();
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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">

      {/* ═══ 1. NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xl font-bold tracking-tight text-[hsl(var(--navy))]">InSchool</span>
            <span className="text-[10px] font-medium mt-1 text-muted-foreground">by AzarLabs</span>
          </div>

          <div className="hidden md:flex items-center gap-5">
            <LangToggle />
            <button onClick={() => navigate("/verify")} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <BadgeCheck className="w-4 h-4" /> {t("nav_verify")}
            </button>
            <Button className="h-9 px-5 text-sm font-semibold" onClick={() => navigate("/auth")}>
              {t("nav_start")} <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="p-2"><Menu className="w-5 h-5 text-foreground" /></button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card pt-12 w-72">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-muted-foreground">Lingua</span>
                    <LangToggle />
                  </div>
                  <SheetClose asChild>
                    <button onClick={() => navigate("/verify")} className="flex items-center gap-2 text-sm font-medium py-2 text-foreground">
                      <BadgeCheck className="w-4 h-4" /> {t("nav_verify")}
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button className="justify-center" onClick={() => navigate("/auth")}>{t("nav_start")}</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* ═══ 2. HERO ═══ */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-5 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-[55%_45%] gap-12 md:gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-8 border border-border text-muted-foreground">
              {t("hero_badge")}
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[52px] font-bold leading-[1.08] tracking-tight mb-6 text-[hsl(var(--navy))]">
              {t("hero_title_1")}<br />{t("hero_title_2")}
            </h1>

            <p className="text-base md:text-lg leading-relaxed mb-8 max-w-lg text-muted-foreground">
              {t("hero_subtitle").split("\n").map((line, index) => (
                <span key={`${line}-${index}`}>
                  {index > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>

            <Button size="lg" className="h-13 px-8 text-sm font-bold w-full sm:w-auto mb-6" onClick={() => navigate("/auth")}>
              {t("hero_cta")} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              {[t("hero_trust_1"), t("hero_trust_2"), t("hero_trust_3")].map((item) => (
                <span key={item} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-600" />{item}</span>
              ))}
            </div>
          </motion.div>

          {/* Chat simulation */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              {/* Titlebar */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-[hsl(var(--navy))]">Coach Marco</span>
              </div>
              {/* Messages */}
              <div className="p-5 space-y-4 text-sm">
                {/* Coach */}
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-foreground">"L'ultima volta ti eri fermato sul discriminante. Cosa ricordi?"</p>
                  </div>
                </div>
                {/* Student */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                    <p>"Serve per capire quante soluzioni ha l'equazione?"</p>
                  </div>
                </div>
                {/* Coach */}
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-foreground">"Esatto. E come si calcola? Parti dalla formula — cosa noti?"</p>
                  </div>
                </div>
              </div>
              {/* Bloom bar */}
              <div className="px-5 pb-4 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">Bloom L4 · Analizzare</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "70%" }} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 3. SOCIAL PROOF ═══ */}
      <section className="bg-muted/50 border-y border-border py-6 px-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
              { big: "6", sub: t("proof_bloom") },
              { big: "4", sub: t("proof_profiles") },
              { big: "EU AI Act", sub: t("proof_euaiact") },
              { big: "On-Chain", sub: t("proof_chain") },
              { big: "PFA-OMS", sub: t("proof_pfa") },
          ].map((m, i) => (
            <motion.div key={i} {...stagger(i)} className="flex items-baseline gap-2 text-center">
              <span className="font-display text-xl font-bold text-[hsl(var(--navy))]">{m.big}</span>
              <span className="text-xs font-medium text-muted-foreground">{m.sub}</span>
              {i < 4 && <span className="hidden md:block ml-8 text-xs text-border">|</span>}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ 4. EU AI ACT ═══ */}
      <section className="py-20 md:py-28 px-5" style={{ background: "linear-gradient(135deg, hsl(var(--navy)), hsl(var(--accent-blue)))" }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <motion.div {...fadeUp}>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-6 bg-red-500/20 text-red-200 border border-red-500/30">
              {t("euai_badge")}
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight mb-6">
              {t("euai_title_1")}<br />{t("euai_title_2")}
            </h2>
            <p className="text-white/70 leading-relaxed mb-6 whitespace-pre-line">
              {t("euai_body")}
            </p>
            <button onClick={() => navigate("/verify")} className="text-white/90 underline underline-offset-4 text-sm font-medium hover:text-white transition-colors">
              Leggi la strategia tecnica <ChevronRight className="inline w-3.5 h-3.5" />
            </button>
          </motion.div>

          <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
            <div className="rounded-2xl p-6 md:p-8 bg-white/[0.08] border border-white/[0.15]">
              <h3 className="text-sm uppercase font-semibold text-white/70 tracking-wider mb-5">{t("euai_checklist_title")}</h3>
              <ul className="space-y-3">
                {[
                  t("euai_check_1"),
                  t("euai_check_2"),
                  t("euai_check_3"),
                  t("euai_check_4"),
                  t("euai_check_5"),
                  t("euai_check_6"),
                  t("euai_check_7"),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-white/40 mt-5">{t("euai_footnote")}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 5. COME FUNZIONA ═══ */}
      <section className="py-20 md:py-28 px-5 bg-white">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <motion.h2 {...fadeUp} className="font-display text-3xl md:text-4xl font-bold text-[hsl(var(--navy))]">{t("how_title")}</motion.h2>
          <motion.p {...fadeUp} className="text-muted-foreground mt-3">{t("how_subtitle")}</motion.p>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10">
          {[
            { num: "01", icon: Brain, title: t("how_1_title"), desc: t("how_1_body") },
            { num: "02", icon: Sparkles, title: t("how_2_title"), desc: t("how_2_body") },
            { num: "03", icon: BadgeCheck, title: t("how_3_title"), desc: t("how_3_body") },
          ].map((s, i) => (
            <motion.div key={i} {...stagger(i)} className="text-center">
              <span className="font-display text-5xl font-bold text-primary/20">{s.num}</span>
              <div className="w-14 h-14 rounded-2xl mx-auto mt-4 mb-5 flex items-center justify-center bg-primary/10">
                <s.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2 text-[hsl(var(--navy))]">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ 6. PER CHI È ═══ */}
      <section className="py-20 md:py-28 px-5 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.h2 {...fadeUp} className="font-display text-3xl md:text-4xl font-bold mb-14 text-center text-[hsl(var(--navy))]">{t("profiles_title")}</motion.h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                badge: t("profile_junior_badge"), title: t("profile_junior_title"), icon: Users,
                desc: t("profile_junior_body"),
                features: [t("profile_feat_junior_1"), t("profile_feat_junior_2"), t("profile_feat_junior_3")],
              },
              {
                badge: t("profile_high_badge"), title: t("profile_high_title"), icon: BookOpen,
                desc: t("profile_high_body"),
                features: [t("profile_feat_high_1"), t("profile_feat_high_2"), t("profile_feat_high_3")],
              },
              {
                badge: t("profile_uni_badge"), title: t("profile_uni_title"), icon: GraduationCap,
                desc: t("profile_uni_body"),
                features: [t("profile_feat_uni_1"), t("profile_feat_uni_2"), t("profile_feat_uni_3")],
              },
              {
                badge: t("profile_teacher_badge"), title: t("profile_teacher_title"), icon: BookMarked, borderClass: "border-l-[hsl(var(--navy))]",
                desc: t("profile_teacher_body"),
                features: [t("profile_feat_teacher_1"), t("profile_feat_teacher_2"), t("profile_feat_teacher_3")],
              },
            ].map((c, i) => (
              <motion.div
                key={i}
                {...stagger(i)}
                className="bg-card border border-border border-l-4 border-l-primary rounded-[var(--radius-xl)] p-6 flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
                style={c.borderClass ? { borderLeftColor: "hsl(var(--navy))" } : undefined}
                onClick={() => navigate("/auth")}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full self-start mb-4 bg-primary/10 text-primary">{c.badge}</span>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className="w-5 h-5 text-[hsl(var(--navy))]" />
                  <h3 className="font-display text-lg font-bold text-[hsl(var(--navy))]">{c.title}</h3>
                </div>
                <p className="text-sm leading-relaxed mb-4 flex-1 text-muted-foreground">{c.desc}</p>
                <ul className="space-y-2 mb-5">
                  {c.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Check className="w-3 h-3 shrink-0 text-green-600" />{f}
                    </li>
                  ))}
                </ul>
                <span className="text-sm font-semibold flex items-center gap-1 text-primary">
                  {t("profile_cta").replace(" →", "")} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. CTA FINALE ═══ */}
      <section className="py-24 md:py-32 px-5 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--navy)), hsl(var(--accent-blue)))" }}>
        <motion.div {...fadeUp} className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight mb-6">
            {t("cta_title_1")}<br />{t("cta_title_2")}
          </h2>
          <p className="text-white/70 text-lg mb-10">{t("cta_subtitle")}</p>
          <Button size="lg" variant="secondary" className="h-14 px-10 text-base font-bold bg-white text-[hsl(var(--navy))] hover:bg-white/90" onClick={() => navigate("/auth")}>
            {t("cta_button").replace(" →", "")} <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <p className="mt-5">
            <button onClick={() => navigate("/auth")} className="text-white/50 underline text-sm hover:text-white/80 transition-colors">{t("cta_login")}</button>
          </p>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-14 px-5 bg-[#0F172A] border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 mb-10">
          <div>
            <span className="font-display text-lg font-bold text-white">InSchool</span>
            <p className="text-sm mt-2 leading-relaxed text-slate-400">Il Coach AI che insegna a ragionare.</p>
            <p className="text-xs mt-3 text-slate-500">AzarLabs · Tenks S.r.l.s. · Calabria, Italia</p>
            <p className="text-xs mt-1 text-slate-500">contact@inschool.ai</p>
          </div>
          <div>
            <h4 className="font-display font-bold text-sm mb-3 text-white">Prodotto</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button onClick={() => navigate("/verify")} className="hover:text-white transition-colors flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> {t("nav_verify")}</button></li>
              <li><button onClick={() => navigate("/auth")} className="hover:text-white transition-colors">{t("nav_start")}</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-bold text-sm mb-3 text-white">Legale</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button onClick={() => navigate("/privacy")} className="hover:text-white transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => navigate("/security")} className="hover:text-white transition-colors">Protezione Minori</button></li>
              <li><a href="#" className="hover:text-white transition-colors">EU AI Act Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-6 text-center text-xs border-t border-slate-800 text-slate-500">
          © 2026 InSchool · AzarLabs · Tutti i diritti riservati
        </div>
      </footer>
    </div>
  );
};

export default Landing;
