import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Zap, Coffee, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TrustSection } from "@/components/landing/TrustSection";
import { TeacherHomeMockup } from "@/components/landing/TeacherHomeMockup";
import { TeacherGenerateMockup } from "@/components/landing/TeacherGenerateMockup";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.3 },
};

export default function LandingDocenti() {
  const { t } = useLang();

  const benefits = [
    { icon: BarChart3, tTitle: "doc_new_ben_1_title" as const, tBody: "doc_new_ben_1_body" as const },
    { icon: Zap, tTitle: "doc_new_ben_2_title" as const, tBody: "doc_new_ben_2_body" as const },
    { icon: Coffee, tTitle: "doc_new_ben_3_title" as const, tBody: "doc_new_ben_3_body" as const },
  ];

  const whoCards = [
    { title: "doc_new_who_1_title" as const, body: "doc_new_who_1_body" as const },
    { title: "doc_new_who_2_title" as const, body: "doc_new_who_2_body" as const },
    { title: "doc_new_who_3_title" as const, body: "doc_new_who_3_body" as const },
  ];

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* ── HERO ── */}
      <section className="pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.span {...fade} className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold mb-6" style={{ backgroundColor: "rgba(26,58,92,0.1)", color: "#1A3A5C" }}>
            {t("doc_hero_label")}
          </motion.span>
          <motion.h1 {...fade} transition={{ delay: 0.05 }} className="font-display text-5xl font-bold leading-tight" style={{ color: "#1A3A5C" }}>
            {t("doc_new_hero_title")}
          </motion.h1>
          <motion.p {...fade} transition={{ delay: 0.1 }} className="text-xl mt-2" style={{ color: "#64748B" }}>
            {t("doc_new_hero_sub")}
          </motion.p>
          <motion.p {...fade} transition={{ delay: 0.15 }} className="text-base max-w-xl mx-auto mt-3" style={{ color: "#94A3B8" }}>
            {t("doc_new_hero_body")}
          </motion.p>
          <motion.div {...fade} transition={{ delay: 0.2 }} className="mt-8 flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg" style={{ backgroundColor: "#0070C0" }} className="rounded-lg hover:opacity-90">
              <Link to="/auth">{t("doc_hero_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-lg border-slate-300 text-slate-700">
              <a href="#come-funziona">{t("doc_hero_cta2")}</a>
            </Button>
          </motion.div>
          <motion.div {...fade} transition={{ delay: 0.25 }} className="mt-5 flex gap-6 justify-center text-xs" style={{ color: "#94A3B8" }}>
            <span>{t("home_hero_micro1")}</span>
            <span>{t("home_hero_micro3")}</span>
            <span>{t("home_hero_micro2")}</span>
          </motion.div>
        </div>
      </section>

      {/* ── COME TI AIUTA + MOCKUP ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("doc_new_ben_title")}
          </motion.h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10 items-center">
            <div className="space-y-6">
              {benefits.map(({ icon: Icon, tTitle, tBody }, i) => (
                <motion.div key={tTitle} {...fade} transition={{ delay: i * 0.05 }} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <Icon className="w-7 h-7 mb-4" style={{ color: "#0070C0" }} />
                  <h3 className="font-semibold" style={{ color: "#1A3A5C" }}>{t(tTitle)}</h3>
                  <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t(tBody)}</p>
                </motion.div>
              ))}
            </div>
            <div className="flex justify-center">
              <TeacherHomeMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── COME FUNZIONA ── */}
      <section id="come-funziona" className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("how_title")}
          </motion.h2>
          <div className="mt-10 space-y-8">
            {(["1", "2", "3"] as const).map((n, i) => (
              <motion.div key={n} {...fade} transition={{ delay: i * 0.05 }} className="flex gap-5">
                <span className="font-display text-4xl font-bold" style={{ color: "#0070C0", opacity: 0.3 }}>0{n}</span>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: "#1A3A5C" }}>{t(`doc_new_how_${n}` as any)}</h4>
                  <p className="text-sm mt-1" style={{ color: "#64748B" }}>{t(`doc_new_how_${n}b` as any)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MOCKUP GENERA CON AI ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="font-display text-2xl font-bold mb-4"
            style={{ color: "#1A3A5C" }}
          >
            Genera materiali in pochi secondi
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="text-sm mb-10"
            style={{ color: "#64748B" }}
          >
            Descrivi cosa ti serve e l'AI prepara verifiche, esercizi e materiali pronti da assegnare.
          </motion.p>
          <TeacherGenerateMockup />
        </div>
      </section>

      {/* ── PENSATO PER CHI INSEGNA ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("doc_new_who_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            {whoCards.map((card, i) => (
              <motion.div key={card.title} {...fade} transition={{ delay: i * 0.05 }} className="bg-white border-t-4 rounded-xl p-6 shadow-sm" style={{ borderColor: "#1A3A5C" }}>
                <h3 className="font-semibold" style={{ color: "#1A3A5C" }}>{t(card.title)}</h3>
                <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t(card.body)}</p>
                <Link to="/auth" className="inline-flex items-center gap-1 text-sm font-medium mt-4" style={{ color: "#0070C0" }}>
                  <ArrowRight className="w-3.5 h-3.5" /> {t("profile_cta")}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEMPO PERSONALE ── */}
      <section className="py-16 px-6 text-center" style={{ backgroundColor: "#1A3A5C" }}>
        <motion.h2 {...fade} className="font-display text-2xl font-bold text-white">
          {t("doc_new_time_title")}
        </motion.h2>
        <motion.p {...fade} transition={{ delay: 0.05 }} className="max-w-xl mx-auto mt-4" style={{ color: "rgba(255,255,255,0.6)" }}>
          {t("doc_new_time_body")}
        </motion.p>
      </section>

      {/* ── TRUST ── */}
      <TrustSection />

      {/* ── CTA FINALE ── */}
      <section className="py-20 px-6 text-center" style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}>
        <motion.h2 {...fade} className="font-display text-3xl font-bold text-white">
          {t("home_final_title")}
        </motion.h2>
        <motion.p {...fade} transition={{ delay: 0.05 }} className="mt-4" style={{ color: "rgba(255,255,255,0.7)" }}>
          {t("doc_final_title")}
        </motion.p>
        <motion.div {...fade} transition={{ delay: 0.1 }} className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg" className="rounded-lg bg-white font-semibold px-6 py-3 hover:bg-white/90" style={{ color: "#1A3A5C" }}>
            <Link to="/auth">{t("doc_final_cta1")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-lg px-6 py-3 text-white border-white/40 hover:bg-white/10">
            <Link to="/auth">{t("doc_final_cta2")}</Link>
          </Button>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
}
