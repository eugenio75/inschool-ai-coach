import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  Sliders,
  Clock,
  BookOpen,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TrustSection } from "@/components/landing/TrustSection";
import type { TranslationKey } from "@/lib/i18n";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.3 },
};

const LandingDocenti = () => {
  const { t, lang } = useLang();

  const benefits = [
    { icon: BarChart3, title: t("doc_ben_1_title"), body: t("doc_ben_1_body") },
    { icon: Sliders, title: t("doc_ben_2_title"), body: t("doc_ben_2_body") },
    { icon: Clock, title: t("doc_ben_3_title"), body: t("doc_ben_3_body") },
  ];

  const howSteps = [t("doc_how_1"), t("doc_how_2"), t("doc_how_3")];

  const profiles: {
    title: TranslationKey;
    body: TranslationKey;
    features: TranslationKey[];
  }[] = [
    {
      title: "doc_who_1_title",
      body: "doc_who_1_body",
      features: ["doc_who_1_1", "doc_who_1_2", "doc_who_1_3"],
    },
    {
      title: "doc_who_2_title",
      body: "doc_who_2_body",
      features: ["doc_who_2_1", "doc_who_2_2", "doc_who_2_3"],
    },
    {
      title: "doc_who_3_title",
      body: "doc_who_3_body",
      features: ["doc_who_3_1", "doc_who_3_2", "doc_who_3_3"],
    },
  ];

  const diffs = [t("doc_diff_1"), t("doc_diff_2"), t("doc_diff_3")];

  const extraTrustLine =
    lang === "it"
      ? "Conforme alle normative per l'uso dell'AI nelle istituzioni scolastiche e universitarie pubbliche"
      : "Compliant with regulations for AI use in public school and university institutions";

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* HERO */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div {...fade}>
            <span
              className="inline-block text-xs font-medium px-4 py-1.5 rounded-full border mb-6"
              style={{ color: "#1A3A5C", borderColor: "rgba(26,58,92,0.2)", backgroundColor: "rgba(26,58,92,0.05)" }}
            >
              {t("doc_hero_label")}
            </span>
          </motion.div>

          <motion.h1 {...fade} transition={{ duration: 0.3, delay: 0.05 }} className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight" style={{ color: "#1A3A5C" }}>
            {t("doc_hero_title")}
          </motion.h1>

          <motion.p {...fade} transition={{ duration: 0.3, delay: 0.1 }} className="text-lg sm:text-xl mt-4" style={{ color: "#64748B" }}>
            {t("doc_hero_sub")}
          </motion.p>

          <motion.p {...fade} transition={{ duration: 0.3, delay: 0.15 }} className="text-base mt-3 max-w-2xl mx-auto" style={{ color: "#94A3B8" }}>
            {t("doc_hero_body")}
          </motion.p>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.2 }} className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Button asChild size="lg" style={{ backgroundColor: "#0070C0" }} className="hover:opacity-90 px-8">
              <Link to="/auth">{t("doc_hero_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#come-funziona">{t("doc_hero_cta2")}</a>
            </Button>
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.25 }} className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs" style={{ color: "#94A3B8" }}>
            <span>· {t("home_hero_micro3")}</span>
            <span>· {t("home_hero_micro1")}</span>
            <span>· {t("home_hero_micro2")}</span>
          </motion.div>
        </div>
      </section>

      {/* BENEFICI */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("doc_ben_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
                style={{ borderColor: "#E2E8F0" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(26,58,92,0.08)" }}>
                  <b.icon className="w-5 h-5" style={{ color: "#1A3A5C" }} />
                </div>
                <h3 className="font-display font-semibold mb-2" style={{ color: "#1A3A5C" }}>{b.title}</h3>
                <p className="text-sm" style={{ color: "#64748B" }}>{b.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* VALORE DOCENTE */}
      <section className="py-16 px-6 bg-white">
        <motion.div
          {...fade}
          className="max-w-3xl mx-auto rounded-2xl p-8 md:p-10 text-center"
          style={{ backgroundColor: "rgba(26,58,92,0.05)", border: "1px solid rgba(26,58,92,0.15)" }}
        >
          <BookOpen className="w-8 h-8 mx-auto mb-4" style={{ color: "#1A3A5C" }} />
          <h2 className="font-display text-xl md:text-2xl font-bold mb-3" style={{ color: "#1A3A5C" }}>
            {t("doc_val_title")}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
            {t("doc_val_body")}
          </p>
        </motion.div>
      </section>

      {/* COME FUNZIONA */}
      <section id="come-funziona" className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("doc_how_title")}
          </motion.h2>
          <div className="flex flex-col gap-6">
            {howSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="flex gap-4"
              >
                <span className="font-display text-2xl font-bold min-w-8" style={{ color: "#0070C0" }}>0{i + 1}</span>
                <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>{step}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PER CHI È */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("doc_who_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profiles.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="bg-white rounded-xl border shadow-sm p-6"
                style={{ borderColor: "#E2E8F0", borderTop: "4px solid #1A3A5C" }}
              >
                <h3 className="font-display font-semibold mb-2" style={{ color: "#1A3A5C" }}>{t(p.title)}</h3>
                <p className="text-sm mb-4" style={{ color: "#64748B" }}>{t(p.body)}</p>
                <ul className="flex flex-col gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "#475569" }}>
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#1A3A5C" }} />
                      {t(f)}
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="inline-flex items-center gap-1 text-sm font-medium mt-4" style={{ color: "#0070C0" }}>
                  {t("doc_hero_cta1")} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFERENZA */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("doc_diff_title")}
          </motion.h2>
          <div className="flex flex-col gap-4">
            {diffs.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="flex items-start gap-3"
              >
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#0070C0" }} />
                <p className="text-sm" style={{ color: "#475569" }}>{d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <TrustSection extraLine={extraTrustLine} />

      {/* CTA FINALE */}
      <section className="py-24 px-6 text-center" style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}>
        <motion.div {...fade} className="max-w-2xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-6 leading-snug">
            {t("doc_final_title")}
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white hover:bg-slate-100 px-8" style={{ color: "#1A3A5C" }}>
              <Link to="/auth">{t("doc_final_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 hover:text-white">
              <Link to="/auth">{t("doc_final_cta2")}</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default LandingDocenti;
