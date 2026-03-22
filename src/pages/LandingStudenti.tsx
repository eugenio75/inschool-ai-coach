import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain,
  Map,
  Heart,
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

const LandingStudenti = () => {
  const { t } = useLang();

  const benefits = [
    { icon: Brain, title: t("st_ben_1_title"), body: t("st_ben_1_body") },
    { icon: Map, title: t("st_ben_2_title"), body: t("st_ben_2_body") },
    { icon: Heart, title: t("st_ben_3_title"), body: t("st_ben_3_body") },
  ];

  const howSteps = [t("st_how_1"), t("st_how_2"), t("st_how_3")];

  const profiles: {
    title: TranslationKey;
    body: TranslationKey;
    features: TranslationKey[];
  }[] = [
    {
      title: "st_who_elem_title",
      body: "st_who_elem_body",
      features: ["st_who_elem_1", "st_who_elem_2", "st_who_elem_3"],
    },
    {
      title: "st_who_medie_title",
      body: "st_who_medie_body",
      features: ["st_who_medie_1", "st_who_medie_2", "st_who_medie_3"],
    },
    {
      title: "st_who_sup_title",
      body: "st_who_sup_body",
      features: ["st_who_sup_1", "st_who_sup_2", "st_who_sup_3"],
    },
    {
      title: "st_who_uni_title",
      body: "st_who_uni_body",
      features: ["st_who_uni_1", "st_who_uni_2", "st_who_uni_3"],
    },
  ];

  const diffs = [t("st_diff_1"), t("st_diff_2"), t("st_diff_3")];

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* HERO */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div {...fade}>
            <span
              className="inline-block text-xs font-medium px-4 py-1.5 rounded-full border mb-6"
              style={{ color: "#0070C0", borderColor: "rgba(0,112,192,0.2)", backgroundColor: "rgba(0,112,192,0.05)" }}
            >
              {t("st_hero_label")}
            </span>
          </motion.div>

          <motion.h1
            {...fade}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
            style={{ color: "#1A3A5C" }}
          >
            {t("st_hero_title")}
          </motion.h1>

          <motion.p {...fade} transition={{ duration: 0.3, delay: 0.1 }} className="text-lg sm:text-xl mt-4" style={{ color: "#64748B" }}>
            {t("st_hero_sub")}
          </motion.p>

          <motion.p {...fade} transition={{ duration: 0.3, delay: 0.15 }} className="text-base mt-3 max-w-2xl mx-auto" style={{ color: "#94A3B8" }}>
            {t("st_hero_body")}
          </motion.p>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.2 }} className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Button asChild size="lg" style={{ backgroundColor: "#0070C0" }} className="hover:opacity-90 px-8">
              <Link to="/auth">{t("st_hero_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#come-funziona">{t("st_hero_cta2")}</a>
            </Button>
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.25 }} className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs" style={{ color: "#94A3B8" }}>
            <span>· {t("home_hero_micro1")}</span>
            <span>· {t("home_hero_micro2")}</span>
            <span>· {t("home_hero_micro3")}</span>
          </motion.div>
        </div>
      </section>

      {/* BENEFICI */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("st_ben_title")}
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "#E8F4FD" }}>
                  <b.icon className="w-5 h-5" style={{ color: "#0070C0" }} />
                </div>
                <h3 className="font-display font-semibold mb-2" style={{ color: "#1A3A5C" }}>{b.title}</h3>
                <p className="text-sm" style={{ color: "#64748B" }}>{b.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SUPPORTO EMOTIVO */}
      <section className="py-16 px-6 bg-white">
        <motion.div
          {...fade}
          className="max-w-3xl mx-auto rounded-2xl p-8 md:p-10 text-center"
          style={{ backgroundColor: "#E8F4FD", border: "1px solid #B3D7F0" }}
        >
          <Heart className="w-8 h-8 mx-auto mb-4" style={{ color: "#0070C0" }} />
          <h2 className="font-display text-xl md:text-2xl font-bold mb-3" style={{ color: "#1A3A5C" }}>
            {t("st_emo_title")}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
            {t("st_emo_body")}
          </p>
        </motion.div>
      </section>

      {/* CRESCITA */}
      <section className="py-16 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <motion.div {...fade} className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#0F172A" }}>
            {t("st_grow_title")}
          </h2>
          <p className="text-base mt-4" style={{ color: "#64748B" }}>
            {t("st_grow_body")}
          </p>
        </motion.div>
      </section>

      {/* COME FUNZIONA */}
      <section id="come-funziona" className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("st_how_title")}
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
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("st_who_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {profiles.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="bg-white rounded-xl border shadow-sm p-6"
                style={{ borderColor: "#E2E8F0", borderTop: "4px solid #0070C0" }}
              >
                <h3 className="font-display font-semibold mb-2" style={{ color: "#1A3A5C" }}>{t(p.title)}</h3>
                <p className="text-sm mb-4" style={{ color: "#64748B" }}>{t(p.body)}</p>
                <ul className="flex flex-col gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "#475569" }}>
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#0070C0" }} />
                      {t(f)}
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="inline-flex items-center gap-1 text-sm font-medium mt-4" style={{ color: "#0070C0" }}>
                  {t("st_hero_cta1")} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAMIGLIA */}
      <section className="py-16 px-6" style={{ backgroundColor: "#1A3A5C" }}>
        <motion.div {...fade} className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
            {t("st_fam_title")}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
            {t("st_fam_body")}
          </p>
        </motion.div>
      </section>

      {/* DIFFERENZA */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: "#0F172A" }}>
            {t("st_diff_title")}
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
      <TrustSection />

      {/* CTA FINALE */}
      <section className="py-24 px-6 text-center" style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}>
        <motion.div {...fade} className="max-w-xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            {t("st_final_title")}
          </h2>
          <p className="text-base mb-8" style={{ color: "#CBD5E1" }}>
            {t("st_final_body")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white hover:bg-slate-100 px-8" style={{ color: "#1A3A5C" }}>
              <Link to="/auth">{t("st_final_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 hover:text-white">
              <Link to="/auth">{t("st_final_cta2")}</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default LandingStudenti;
