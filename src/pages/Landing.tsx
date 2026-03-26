import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap, BookOpen, Timer, Brain, Smile,
  Zap, Users, FolderOpen, BadgeCheck, Shield, Lock,
  ArrowRight, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TrustSection } from "@/components/landing/TrustSection";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.3 },
};

export default function Landing() {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* ── HERO ── */}
      <section className="pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.h1 {...fade} className="font-display text-5xl md:text-6xl font-bold leading-tight" style={{ color: "#1A3A5C" }}>
            {t("home_new_hero_title_1")}<br />{t("home_new_hero_title_2")}
          </motion.h1>
          <motion.p {...fade} transition={{ delay: 0.05 }} className="text-xl mt-3" style={{ color: "#64748B" }}>
            {t("home_new_hero_sub")}
          </motion.p>
          <motion.p {...fade} transition={{ delay: 0.1 }} className="text-base max-w-2xl mx-auto mt-4" style={{ color: "#94A3B8" }}>
            {t("home_new_hero_body")}
          </motion.p>
          <motion.div {...fade} transition={{ delay: 0.15 }} className="mt-8 flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg" style={{ backgroundColor: "#0070C0" }} className="rounded-lg hover:opacity-90">
              <Link to="/auth">{t("home_hero_cta1") || "Inizia gratis"}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-lg border-slate-300 text-slate-700">
              <a href="#come-funziona">{t("home_hero_cta2") || "Scopri come funziona"}</a>
            </Button>
          </motion.div>
          <motion.div {...fade} transition={{ delay: 0.2 }} className="mt-5 flex gap-6 justify-center text-xs" style={{ color: "#94A3B8" }}>
            <span>{t("home_hero_micro1")}</span>
            <span>{t("home_hero_micro2")}</span>
            <span>{t("home_hero_micro3")}</span>
          </motion.div>
        </div>
      </section>

      {/* ── SPLIT PERCORSI ── */}
      <section id="percorsi" className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-3xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("home_new_split_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            <motion.div {...fade} transition={{ delay: 0.05 }} className="bg-white rounded-xl p-8 border-l-4 hover:shadow-md transition-shadow" style={{ borderColor: "#0070C0" }}>
              <GraduationCap className="w-8 h-8 mb-4" style={{ color: "#0070C0" }} />
              <h3 className="font-display text-xl font-bold" style={{ color: "#1A3A5C" }}>{t("home_split_s_title")}</h3>
              <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t("home_new_split_s_body")}</p>
              <Link to="/studenti" className="inline-flex items-center gap-1 text-sm font-medium mt-4" style={{ color: "#0070C0" }}>
                <ArrowRight className="w-4 h-4" /> {t("home_split_s_cta")}
              </Link>
            </motion.div>
            <motion.div {...fade} transition={{ delay: 0.1 }} className="bg-white rounded-xl p-8 border-l-4 hover:shadow-md transition-shadow" style={{ borderColor: "#1A3A5C" }}>
              <BookOpen className="w-8 h-8 mb-4" style={{ color: "#1A3A5C" }} />
              <h3 className="font-display text-xl font-bold" style={{ color: "#1A3A5C" }}>{t("home_split_d_title")}</h3>
              <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t("home_new_split_d_body")}</p>
              <Link to="/docenti" className="inline-flex items-center gap-1 text-sm font-medium mt-4" style={{ color: "#0070C0" }}>
                <ArrowRight className="w-4 h-4" /> {t("home_split_d_cta")}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── COSA CAMBIA DAVVERO ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("home_new_diff_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
            {/* Students */}
            <div>
              <p className="text-sm uppercase font-semibold mb-6 tracking-wider" style={{ color: "#94A3B8" }}>{t("home_new_diff_s_label")}</p>
              <div className="space-y-8">
                {([
                  { icon: Timer, tKey: "s1" },
                  { icon: Brain, tKey: "s2" },
                  { icon: Smile, tKey: "s3" },
                ] as const).map(({ icon: Icon, tKey }, i) => (
                  <motion.div key={tKey} {...fade} transition={{ delay: i * 0.05 }} className="flex gap-4">
                    <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "#0070C0" }} />
                    <div>
                      <h4 className="font-bold text-sm" style={{ color: "#1A3A5C" }}>{t(`home_new_diff_${tKey}_title` as any)}</h4>
                      <p className="text-sm mt-1" style={{ color: "#64748B" }}>{t(`home_new_diff_${tKey}_body` as any)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            {/* Teachers */}
            <div>
              <p className="text-sm uppercase font-semibold mb-6 tracking-wider" style={{ color: "#94A3B8" }}>{t("home_new_diff_d_label")}</p>
              <div className="space-y-8">
                {([
                  { icon: Zap, tKey: "d1" },
                  { icon: Users, tKey: "d2" },
                  { icon: FolderOpen, tKey: "d3" },
                ] as const).map(({ icon: Icon, tKey }, i) => (
                  <motion.div key={tKey} {...fade} transition={{ delay: i * 0.05 }} className="flex gap-4">
                    <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "#1A3A5C" }} />
                    <div>
                      <h4 className="font-bold text-sm" style={{ color: "#1A3A5C" }}>{t(`home_new_diff_${tKey}_title` as any)}</h4>
                      <p className="text-sm mt-1" style={{ color: "#64748B" }}>{t(`home_new_diff_${tKey}_body` as any)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COME FUNZIONA ── */}
      <section id="come-funziona" className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("how_title")}
          </motion.h2>
          <div className="mt-10 space-y-8">
            {(["1", "2", "3"] as const).map((n, i) => (
              <motion.div key={n} {...fade} transition={{ delay: i * 0.05 }} className="flex gap-5">
                <span className="font-display text-4xl font-bold" style={{ color: "#0070C0", opacity: 0.3 }}>0{n}</span>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: "#1A3A5C" }}>{t(`home_new_how_${n}_title` as any)}</h4>
                  <p className="text-sm mt-1" style={{ color: "#64748B" }}>{t(`home_new_how_${n}_body` as any)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <TrustSection />

      {/* ── CTA FINALE ── */}
      <section className="py-24 px-6 text-center" style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}>
        <motion.h2 {...fade} className="font-display text-4xl font-bold text-white">
          {t("home_final_title")}
        </motion.h2>
        <motion.p {...fade} transition={{ delay: 0.05 }} className="text-lg mt-4" style={{ color: "rgba(255,255,255,0.7)" }}>
          {t("home_final_body")}
        </motion.p>
        <motion.div {...fade} transition={{ delay: 0.1 }} className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg" className="rounded-lg bg-white font-semibold px-6 py-3 hover:bg-white/90" style={{ color: "#1A3A5C" }}>
            <Link to="/auth">{t("home_final_cta1")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-lg px-6 py-3 border-white/40 hover:bg-white/10" style={{ color: "white", borderColor: "rgba(255,255,255,0.4)" }}>
            <Link to="/docenti">{t("home_final_cta2")}</Link>
          </Button>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
}
