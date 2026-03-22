import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle,
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

const Landing = () => {
  const { t } = useLang();

  const howSteps = [
    t("home_how_1"),
    t("home_how_2"),
    t("home_how_3"),
  ];

  const diffs = [
    { title: t("home_diff_1_title"), body: t("home_diff_1_body") },
    { title: t("home_diff_2_title"), body: t("home_diff_2_body") },
    { title: t("home_diff_3_title"), body: t("home_diff_3_body") },
  ];

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
              {t("home_hero_label")}
            </span>
          </motion.div>

          <motion.h1
            {...fade}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
            style={{ color: "#1A3A5C" }}
          >
            {t("home_hero_title")}
          </motion.h1>

          <motion.p
            {...fade}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-lg sm:text-xl mt-4"
            style={{ color: "#64748B" }}
          >
            {t("home_hero_sub")}
          </motion.p>

          <motion.p
            {...fade}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="text-base mt-3 max-w-2xl mx-auto"
            style={{ color: "#94A3B8" }}
          >
            {t("home_hero_body")}
          </motion.p>

          <motion.div
            {...fade}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8"
          >
            <Button asChild size="lg" style={{ backgroundColor: "#0070C0" }} className="hover:opacity-90 px-8">
              <Link to="/auth">{t("home_hero_cta1")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#come-funziona">{t("home_hero_cta2")}</a>
            </Button>
          </motion.div>

          <motion.div
            {...fade}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs"
            style={{ color: "#94A3B8" }}
          >
            <span>· {t("home_hero_micro1")}</span>
            <span>· {t("home_hero_micro2")}</span>
            <span>· {t("home_hero_micro3")}</span>
          </motion.div>
        </div>
      </section>

      {/* SPLIT PERCORSI */}
      <section id="percorsi" className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2
            {...fade}
            className="font-display text-2xl md:text-3xl font-bold text-center mb-10"
            style={{ color: "#0F172A" }}
          >
            {t("home_split_title")}
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Studenti */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              style={{ borderLeft: "4px solid #0070C0" }}
            >
              <GraduationCap className="w-8 h-8 mb-4" style={{ color: "#0070C0" }} />
              <h3 className="font-display text-xl font-bold mb-2" style={{ color: "#1A3A5C" }}>
                {t("home_split_s_title")}
              </h3>
              <p className="text-sm mb-4" style={{ color: "#64748B" }}>
                {t("home_split_s_body")}
              </p>
              <Link
                to="/studenti"
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: "#0070C0" }}
              >
                {t("home_split_s_cta")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Docenti */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              style={{ borderLeft: "4px solid #0070C0" }}
            >
              <BookOpen className="w-8 h-8 mb-4" style={{ color: "#0070C0" }} />
              <h3 className="font-display text-xl font-bold mb-2" style={{ color: "#1A3A5C" }}>
                {t("home_split_d_title")}
              </h3>
              <p className="text-sm mb-4" style={{ color: "#64748B" }}>
                {t("home_split_d_body")}
              </p>
              <Link
                to="/docenti"
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: "#0070C0" }}
              >
                {t("home_split_d_cta")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PERCHÉ INSCHOOL */}
      <section id="perche" className="py-20 px-6 bg-white">
        <motion.div {...fade} className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#0F172A" }}>
            {t("home_why_title")}
          </h2>
          <p className="text-base mt-4" style={{ color: "#64748B" }}>
            {t("home_why_body")}
          </p>
        </motion.div>
      </section>

      {/* COME FUNZIONA */}
      <section id="come-funziona" className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-2xl mx-auto">
          <motion.h2
            {...fade}
            className="font-display text-2xl md:text-3xl font-bold text-center mb-10"
            style={{ color: "#0F172A" }}
          >
            {t("home_how_title")}
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
                <span className="font-display text-2xl font-bold min-w-8" style={{ color: "#0070C0" }}>
                  0{i + 1}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
                  {step}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFERENZA */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            {...fade}
            className="font-display text-2xl md:text-3xl font-bold text-center mb-10"
            style={{ color: "#0F172A" }}
          >
            {t("home_diff_title")}
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {diffs.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="rounded-xl border p-6"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                <Sparkles className="w-5 h-5 mb-3" style={{ color: "#0070C0" }} />
                <h3 className="font-display font-semibold mb-2" style={{ color: "#1A3A5C" }}>
                  {d.title}
                </h3>
                <p className="text-sm" style={{ color: "#64748B" }}>
                  {d.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <TrustSection />

      {/* CTA FINALE */}
      <section
        className="py-24 px-6 text-center"
        style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}
      >
        <motion.div {...fade} className="max-w-xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            {t("home_final_title")}
          </h2>
          <p className="text-base mb-8" style={{ color: "#CBD5E1" }}>
            {t("home_final_body")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-white hover:bg-slate-100 px-8"
              style={{ color: "#1A3A5C" }}
            >
              <Link to="/auth">{t("home_final_cta1")}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/docenti">{t("home_final_cta2")}</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default Landing;
