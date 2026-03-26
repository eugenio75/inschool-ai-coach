import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Shield, Lock, Users, BadgeCheck, CheckCircle, Database, Trash2,
  ExternalLink, AlertTriangle,
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

const contracts = [
  { name: "RBACController.sol", addr: "0x8b0543690dF6dAFfCBf4c56D82778C9Ed9bb7332" },
  { name: "AIGovernanceLog.sol", addr: "0x7337DEDceedACed7Bcb52Bb552e001D71b2596a5" },
  { name: "MinorConsentRegistry.sol", addr: "0x74Fc0D36B46433887aE39EA9B43b67f642d5715a" },
  { name: "CredentialNFT.sol (ERC-5192 Soulbound)", addr: "0x57457E2a5B2Aa0cE246E3873306a95277f7E341A" },
];

const euChecks = [
  "euai_check_1", "euai_check_2", "euai_check_3", "euai_check_4",
  "euai_check_5", "euai_check_6", "euai_check_7",
] as const;

export default function Security() {
  const { t } = useLang();

  const archCards = [
    { icon: Shield, color: "#0070C0", tTitle: "sec_arch_1_title" as const, tBody: "sec_arch_1_body" as const, tBadge: "sec_arch_1_badge" as const, dotGreen: true },
    { icon: Lock, color: "#1A3A5C", tTitle: "sec_arch_2_title" as const, tBody: "sec_arch_2_body" as const, tBadge: "sec_arch_2_badge" as const },
    { icon: Users, color: "#16a34a", tTitle: "sec_arch_3_title" as const, tBody: "sec_arch_3_body" as const, tBadge: "sec_arch_3_badge" as const },
    { icon: BadgeCheck, color: "#9333ea", tTitle: "sec_arch_4_title" as const, tBody: "sec_arch_4_body" as const, tBadge: "sec_arch_4_badge" as const },
  ];

  const gdprCards = [
    { icon: Database, color: "#0070C0", tTitle: "sec_gdpr_1_title" as const, tBody: "sec_gdpr_1_body" as const },
    { icon: Trash2, color: "#16a34a", tTitle: "sec_gdpr_2_title" as const, tBody: "sec_gdpr_2_body" as const },
    { icon: Users, color: "#1A3A5C", tTitle: "sec_gdpr_3_title" as const, tBody: "sec_gdpr_3_body" as const },
  ];

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* ── HERO ── */}
      <section className="pt-24 pb-16 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.span {...fade} className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold mb-6" style={{ backgroundColor: "rgba(0,112,192,0.1)", color: "#0070C0" }}>
            {t("home_nav_sicurezza")}
          </motion.span>
          <motion.h1 {...fade} transition={{ delay: 0.05 }} className="font-display text-4xl font-bold" style={{ color: "#1A3A5C" }}>
            {t("sec_hero_title")}
          </motion.h1>
          <motion.p {...fade} transition={{ delay: 0.1 }} className="text-xl mt-3" style={{ color: "#64748B" }}>
            {t("sec_hero_sub")}
          </motion.p>
          <motion.div {...fade} transition={{ delay: 0.15 }} className="flex gap-3 flex-wrap justify-center mt-6">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border" style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }}>
              <Shield className="w-3.5 h-3.5" /> {t("sec_pill_euai")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border" style={{ backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }}>
              <Lock className="w-3.5 h-3.5" /> {t("sec_pill_gdpr")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border" style={{ backgroundColor: "#faf5ff", borderColor: "#e9d5ff", color: "#7e22ce" }}>
              <BadgeCheck className="w-3.5 h-3.5" /> {t("sec_pill_bc")}
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── ARCHITETTURA ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("sec_arch_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            {archCards.map(({ icon: Icon, color, tTitle, tBody, tBadge, dotGreen }, i) => (
              <motion.div key={tTitle} {...fade} transition={{ delay: i * 0.05 }} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-semibold" style={{ color: "#1A3A5C" }}>{t(tTitle)}</h3>
                <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t(tBody)}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-mono" style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}>
                  {dotGreen && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  {t(tBadge)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SMART CONTRACTS ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#1A3A5C" }}>
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-white">
            {t("sec_sc_title")}
          </motion.h2>
          <motion.p {...fade} transition={{ delay: 0.05 }} className="mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            {t("sec_sc_sub")}
          </motion.p>
          <div className="mt-10 space-y-4">
            {contracts.map((c, i) => (
              <motion.div key={c.addr} {...fade} transition={{ delay: i * 0.05 }} className="rounded-xl p-5 border text-left" style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                <p className="text-sm font-mono" style={{ color: "#0070C0" }}>{c.name}</p>
                <p className="text-xs font-mono mt-1 break-all" style={{ color: "rgba(255,255,255,0.4)" }}>{c.addr}</p>
                <a
                  href={`https://explorer.azarlabs.com/address/${c.addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                  style={{ color: "#22d3ee" }}
                >
                  Vedi su explorer <ExternalLink className="w-3 h-3" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EU AI ACT ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2 {...fade} className="font-display text-2xl font-bold" style={{ color: "#1A3A5C" }}>
            {t("sec_euai_title")}
          </motion.h2>
          <motion.p {...fade} transition={{ delay: 0.05 }} className="mt-2 text-sm" style={{ color: "#64748B" }}>
            {t("sec_euai_sub")}
          </motion.p>
          <motion.div {...fade} transition={{ delay: 0.1 }} className="inline-flex items-center gap-2 rounded-full px-4 py-2 mt-4 text-xs font-semibold border" style={{ backgroundColor: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" }}>
            <AlertTriangle className="w-3.5 h-3.5" /> {t("sec_euai_warning")}
          </motion.div>
          <motion.p {...fade} transition={{ delay: 0.15 }} className="mt-4 text-sm" style={{ color: "#64748B" }}>
            {t("sec_euai_body")}
          </motion.p>

          <div className="max-w-xl mx-auto mt-8 space-y-3 text-left">
            {euChecks.map((key, i) => (
              <motion.div key={key} {...fade} transition={{ delay: i * 0.03 }} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                <span className="text-sm" style={{ color: "#334155" }}>{t(key)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GDPR ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="max-w-4xl mx-auto">
          <motion.h2 {...fade} className="font-display text-2xl font-bold text-center" style={{ color: "#1A3A5C" }}>
            {t("sec_gdpr_title")}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            {gdprCards.map(({ icon: Icon, color, tTitle, tBody }, i) => (
              <motion.div key={tTitle} {...fade} transition={{ delay: i * 0.05 }} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <Icon className="w-7 h-7 mb-4" style={{ color }} />
                <h3 className="font-semibold" style={{ color: "#1A3A5C" }}>{t(tTitle)}</h3>
                <p className="text-sm mt-2" style={{ color: "#64748B" }}>{t(tBody)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <TrustSection />

      {/* ── CTA FINALE ── */}
      <section className="py-16 px-6 text-center" style={{ background: "linear-gradient(135deg, #1A3A5C, #0070C0)" }}>
        <motion.h2 {...fade} className="font-display text-2xl font-bold text-white max-w-xl mx-auto">
          {t("sec_cta_title")}
        </motion.h2>
        <motion.div {...fade} transition={{ delay: 0.05 }} className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg" className="rounded-lg bg-white font-semibold px-6 py-3 hover:bg-white/90" style={{ color: "#1A3A5C" }}>
            <a href="https://docs.azarlabs.com" target="_blank" rel="noopener noreferrer">
              {t("sec_cta_docs")} <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-lg px-6 py-3 text-white border-white/40 hover:bg-white/10">
            <Link to="/verify">{t("sec_cta_verify")}</Link>
          </Button>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
}
