import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle,
  BadgeCheck,
  Shield,
  Lock,
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
              <Link to="/auth?role=alunno">{t("home_hero_cta1")}</Link>
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

      {/* ── SEZIONE BLOCKCHAIN ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#0d1b2a" }}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div {...fade} className="text-center mb-12">
            <span
              className="inline-flex items-center gap-2 text-xs font-medium px-4 py-1.5 rounded-full border mb-6"
              style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)", backgroundColor: "rgba(96,165,250,0.08)" }}
            >
              <Shield className="w-3 h-3" />
              Blockchain · Azar Chain · Chain ID 24780
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
              Certificato. Verificabile. Immutabile.
            </h2>
            <p className="text-sm text-white/60 max-w-2xl mx-auto">
              InSchool usa una blockchain privata per certificare le competenze degli studenti
              e garantire la conformità alle normative europee sull'AI in educazione.
            </p>
          </motion.div>

          {/* 3 card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(96,165,250,0.12)" }}>
                <BadgeCheck className="w-5 h-5" style={{ color: "#60a5fa" }} />
              </div>
              <h3 className="font-display font-semibold text-white mb-2">Credenziali verificabili</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Ogni competenza raggiunta diventa un certificato digitale non falsificabile,
                verificabile da scuole, università e aziende in tempo reale.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(96,165,250,0.12)" }}>
                <Shield className="w-5 h-5" style={{ color: "#60a5fa" }} />
              </div>
              <h3 className="font-display font-semibold text-white mb-2">Conformità EU AI Act</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Ogni sessione AI viene registrata con log immutabile on-chain.
                Audit trail automatico per soddisfare le obbligazioni EU AI Act
                (scadenza agosto 2026).
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(96,165,250,0.12)" }}>
                <Lock className="w-5 h-5" style={{ color: "#60a5fa" }} />
              </div>
              <h3 className="font-display font-semibold text-white mb-2">Zero dati personali on-chain</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Nessun nome, email o dato identificativo va sulla blockchain.
                Solo hash anonimi. Pienamente conforme al GDPR e al diritto all'oblio.
              </p>
            </motion.div>
          </div>

          {/* Riga tecnica discreta */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-white/30">
            <span>Azar Chain · PoA / IBFT2</span>
            <span>·</span>
            <span>AIGovernanceLog.sol</span>
            <span>·</span>
            <span>CredentialNFT.sol ERC-5192</span>
            <span>·</span>
            <span>MinorConsentRegistry.sol</span>
            <span>·</span>
            <Link to="/security" className="underline hover:text-white/50 transition-colors">
              Sicurezza e conformità →
            </Link>
          </div>
        </div>
      </section>
      {/* ── fine sezione blockchain ── */}

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
              <Link to="/auth?role=alunno">{t("home_final_cta1")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="px-8 hover:opacity-90"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              <Link to="/auth?role=docente">{t("home_final_cta2")}</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default Landing;
