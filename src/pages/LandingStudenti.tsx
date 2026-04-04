import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Map, Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TrustSection } from "@/components/landing/TrustSection";
import { StudentSessionMockup } from "@/components/landing/StudentSessionMockup";
import { StudentReviewMockup } from "@/components/landing/StudentReviewMockup";


const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.3 },
};

const studentTrustItems = [
  { title: "trust_1" as const, desc: "trust_1_desc" as const },
  { title: "trust_2" as const, desc: "trust_home_minor_desc" as const },
  { title: "trust_3" as const, desc: "trust_3_desc" as const },
  { title: "trust_st_support" as const, desc: "trust_st_support_desc" as const },
  { title: "trust_4" as const, desc: "trust_bc_desc" as const },
  { title: "trust_5" as const, desc: "trust_5_desc" as const },
];

export default function LandingStudenti() {
  const { t } = useLang();

  const benefits = [
    { icon: Brain, tTitle: "st_new_ben_1_title" as const, tBody: "st_new_ben_1_body" as const },
    { icon: Map, tTitle: "st_new_ben_2_title" as const, tBody: "st_new_ben_2_body" as const },
    { icon: Heart, tTitle: "st_new_ben_3_title" as const, tBody: "st_new_ben_3_body" as const },
  ];

  const ageCards = [
    { badge: "st_new_elem_badge" as const, title: "st_new_elem_title" as const, body: "st_new_elem_body" as const },
    { badge: "st_new_medie_badge" as const, title: "st_new_medie_title" as const, body: "st_new_medie_body" as const },
    { badge: "st_new_sup_badge" as const, title: "st_new_sup_title" as const, body: "st_new_sup_body" as const },
    { badge: "st_new_uni_badge" as const, title: "st_new_uni_title" as const, body: "st_new_uni_body" as const },
  ];

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      

      {/* ── HERO ── */}
      <section className="pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.span {...fade} className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold mb-6" style={{ backgroundColor: "rgba(0,112,192,0.1)", color: "#0070C0" }}>
            {t("badge_studenti")}
          </motion.span>
          <motion.h1 {...fade} className="font-display text-5xl font-bold leading-tight" style={{ color: "#1A3A5C" }}>
            {t("st_new_hero_title")}
          </motion.h1>
          <motion.p {...fade} transition={{ delay: 0.05 }} className="text-xl mt-2" style={{ color: "#64748B" }}>
            {t("st_new_hero_sub")}
          </motion.p>
          <motion.p {...fade} transition={{ delay: 0.1 }} className="text-base max-w-xl mx-auto mt-3" style={{ color: "#94A3B8" }}>
            {t("st_new_hero_body")}
          </motion.p>
          <motion.div {...fade} transition={{ delay: 0.15 }} className="mt-8 flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg" style={{ backgroundColor: "#0070C0" }} className="rounded-lg hover:opacity-90">
              <Link to="/auth">{t("st_hero_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-lg border-slate-300 text-slate-700">
              <a href="#come-funziona">{t("st_hero_cta2")}</a>
            </Button>
          </motion.div>
          <motion.div {...fade} transition={{ delay: 0.2 }} className="mt-5 flex gap-6 justify-center text-xs" style={{ color: "#94A3B8" }}>
            <span>{t("home_hero_micro1")}</span>
            <span>{t("home_hero_micro2")}</span>
            <span>{t("home_hero_micro3")}</span>
          </motion.div>
        </div>
      </section>

      {/* ── COME TI AIUTA + MOCKUP SESSION ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center mb-12" style={{ color: "#1A3A5C" }}>
            {t("st_new_ben_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Text left */}
            <div className="space-y-6">
              {benefits.map(({ icon: Icon, tTitle, tBody }, i) => (
                <motion.div key={tTitle} {...fade} transition={{ delay: i * 0.05 }} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <Icon className="w-7 h-7 mb-4" style={{ color: "#0070C0" }} />
                  <h3 className="font-semibold" style={{ color: "#1A3A5C" }}>{t(tTitle)}</h3>
                  <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t(tBody)}</p>
                </motion.div>
              ))}
            </div>
            {/* Mockup right */}
            <motion.div {...fade} transition={{ delay: 0.15 }} className="flex justify-center">
              <StudentSessionMockup />
            </motion.div>
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
                  <h4 className="font-bold text-sm" style={{ color: "#1A3A5C" }}>{t(`st_new_how_${n}` as any)}</h4>
                  <p className="text-sm mt-1" style={{ color: "#64748B" }}>{t(`st_new_how_${n}b` as any)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODI DIVERSI + MOCKUP HOME STUDENTE ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center mb-12" style={{ color: "#1A3A5C" }}>
            {t("st_new_coach_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Mockup left */}
            <motion.div {...fade} transition={{ delay: 0.05 }} className="flex justify-center order-2 md:order-1">
              <StudentReviewMockup />
            </motion.div>
            {/* Cards right */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 order-1 md:order-2">
              {ageCards.map((card, i) => {
                const roleMap = ["/auth?role=alunno", "/auth?role=alunno", "/auth?role=superiori", "/auth?role=universitario"];
                return (
                  <motion.div key={card.title} {...fade} transition={{ delay: i * 0.05 }} className="bg-white border-t-4 rounded-xl p-5 shadow-sm" style={{ borderColor: "#0070C0" }}>
                    <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-2" style={{ backgroundColor: "rgba(0,112,192,0.1)", color: "#0070C0" }}>
                      {t(card.badge)}
                    </span>
                    <h3 className="font-semibold text-sm" style={{ color: "#1A3A5C" }}>{t(card.title)}</h3>
                    <p className="text-xs mt-1.5" style={{ color: "#64748B" }}>{t(card.body)}</p>
                    <Link to={roleMap[i]} className="inline-flex items-center gap-1 text-xs font-medium mt-3" style={{ color: "#0070C0" }}>
                      <ArrowRight className="w-3 h-3" /> {t("profile_cta")}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAMIGLIE ── */}
      <section className="py-16 px-6 text-center" style={{ backgroundColor: "#1A3A5C" }}>
        <motion.h2 {...fade} className="font-display text-2xl font-bold text-white">
          {t("st_new_fam_title")}
        </motion.h2>
        <motion.p {...fade} transition={{ delay: 0.05 }} className="max-w-xl mx-auto mt-4" style={{ color: "rgba(255,255,255,0.6)" }}>
          {t("st_new_fam_body")}
        </motion.p>
      </section>

      {/* ── TRUST ── */}
      <TrustSection items={studentTrustItems} />

      {/* ── CTA FINALE ── */}
      <section className="py-20 px-6 text-center" style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}>
        <motion.h2 {...fade} className="font-display text-3xl font-bold text-white">
          {t("home_final_title")}
        </motion.h2>
        <motion.p {...fade} transition={{ delay: 0.05 }} className="mt-4 whitespace-pre-line" style={{ color: "rgba(255,255,255,0.7)" }}>
          {t("home_cta_final_body")}
        </motion.p>
        <motion.div {...fade} transition={{ delay: 0.1 }} className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg" className="rounded-lg bg-white font-semibold px-6 py-3 hover:bg-white/90" style={{ color: "#1A3A5C" }}>
            <Link to="/auth">{t("st_final_cta1")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-lg px-6 py-3 text-white border-white/40 hover:bg-white/10">
            <Link to="/auth">{t("st_final_cta2")}</Link>
          </Button>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
}
