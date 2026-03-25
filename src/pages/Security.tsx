import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock, Users, BadgeCheck, CheckCircle, ExternalLink, Database, FileText } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
  { name: "CredentialNFT.sol (ERC-5192)", addr: "0x57457E2a5B2Aa0cE246E3873306a95277f7E341A" },
];

const euChecks = [
  "Sistema di gestione del rischio documentato (AIGovernanceLog on-chain)",
  "Governance dei dati certificata (RBACController + MinorConsentRegistry)",
  "Logging immutabile delle sessioni AI (ogni sessione registrata su Azar Chain)",
  "Trasparenza verso studenti e famiglie (consenso certificato + audit trail)",
  "Supervisione umana garantita (RBAC roles — operatori autorizzati con log)",
  "Audit trail automatico e verificabile (explorer pubblico Azar Chain)",
  "Documentazione tecnica per le autorità (ComplianceRegistry on-chain)",
];

const Security = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Torna Indietro
          </Button>
        </div>
      </nav>

      <main className="pt-28 pb-20 px-6 max-w-5xl mx-auto space-y-20">
        {/* ── SEZIONE 1 — Hero ── */}
        <motion.section {...fade} className="text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
            Sicurezza e Conformità
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            InSchool è progettato per meritare fiducia — a ogni livello.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["EU AI Act Compliant", "GDPR Nativo", "Blockchain Certificata"].map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary"
              >
                <CheckCircle className="w-3 h-3" />
                {pill}
              </span>
            ))}
          </div>
        </motion.section>

        {/* ── SEZIONE 2 — Architettura di sicurezza (4 card) ── */}
        <section>
          <motion.h2 {...fade} className="text-2xl md:text-3xl font-display font-bold text-center mb-10">
            Architettura di sicurezza
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <motion.div {...fade} className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <ShieldCheck className="w-7 h-7 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Blockchain privata certificata</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Ogni sessione AI viene registrata su Azar Chain — blockchain privata con consenso
                Proof of Authority. Log immutabili, audit trail automatico, nessun dato personale on-chain.
              </p>
              <span className="inline-block text-[11px] font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                Azar Chain · Chain ID 24780
              </span>
            </motion.div>

            {/* Card 2 */}
            <motion.div {...fade} className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <Lock className="w-7 h-7 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Privacy by Design</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Nessun dato personale va mai sulla blockchain. Solo hash HMAC-SHA256 anonimizzati.
                Nome, email, conversazioni e dati identificativi restano nel database cifrato off-chain.
              </p>
              <span className="inline-block text-[11px] font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                HMAC-SHA256 · Zero PII on-chain
              </span>
            </motion.div>

            {/* Card 3 */}
            <motion.div {...fade} className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <Users className="w-7 h-7 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Consenso genitoriale certificato</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Ogni consenso dei genitori per gli studenti minorenni viene registrato on-chain
                con timestamp immutabile. Revoca istantanea sempre disponibile — certificata sulla chain.
              </p>
              <span className="inline-block text-[11px] font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                MinorConsentRegistry.sol
              </span>
            </motion.div>

            {/* Card 4 */}
            <motion.div {...fade} className="bg-card p-8 rounded-3xl shadow-soft border border-border">
              <BadgeCheck className="w-7 h-7 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Credenziali verificabili</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Le competenze raggiunte diventano Soulbound Token (ERC-5192) su blockchain.
                Non trasferibili, non falsificabili, verificabili pubblicamente da chiunque in tempo reale.
              </p>
              <span className="inline-block text-[11px] font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                ERC-5192 Soulbound · CredentialNFT.sol
              </span>
            </motion.div>
          </div>
        </section>

        {/* ── SEZIONE 3 — Smart contract deployati ── */}
        <motion.section
          {...fade}
          className="rounded-3xl p-8 md:p-12"
          style={{ backgroundColor: "#1A3A5C" }}
        >
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
            Smart Contract attivi su Azar Chain
          </h2>
          <p className="text-white/60 text-sm mb-8">Deployati, verificati e operativi.</p>
          <div className="space-y-4">
            {contracts.map((c) => (
              <div key={c.addr} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-white/5 rounded-xl px-5 py-4 border border-white/10">
                <span className="text-white font-semibold text-sm flex-shrink-0">{c.name}</span>
                <code className="text-white/50 text-xs font-mono break-all flex-1">{c.addr}</code>
                <a
                  href={`https://explorer.azarlabs.com/address/${c.addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors flex-shrink-0"
                >
                  Vedi su explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SEZIONE 4 — Conformità EU AI Act ── */}
        <motion.section {...fade}>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
            Conformità EU AI Act — Scadenza 2 Agosto 2026
          </h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-3xl">
            InSchool è classificato come sistema AI ad alto rischio (Annex III).
            La blockchain soddisfa le obbligazioni principali nativamente.
          </p>
          <div className="space-y-3">
            {euChecks.map((check, i) => (
              <div key={i} className="flex items-start gap-3 bg-card rounded-xl border border-border px-5 py-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{check}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SEZIONE 5 — GDPR e protezione minori ── */}
        <section>
          <motion.h2 {...fade} className="text-2xl md:text-3xl font-display font-bold text-center mb-10">
            GDPR e protezione minori
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div {...fade} className="bg-card p-6 rounded-2xl border border-border text-center">
              <Database className="w-6 h-6 text-primary mx-auto mb-3" />
              <h3 className="font-bold mb-2">Dati personali off-chain</h3>
              <p className="text-xs text-muted-foreground">
                Tutti i dati identificativi in DB cifrato Supabase
              </p>
            </motion.div>
            <motion.div {...fade} className="bg-card p-6 rounded-2xl border border-border text-center">
              <FileText className="w-6 h-6 text-primary mx-auto mb-3" />
              <h3 className="font-bold mb-2">Diritto all'oblio garantito</h3>
              <p className="text-xs text-muted-foreground">
                Cancellazione dal DB senza toccare la chain (gli hash diventano orfani)
              </p>
            </motion.div>
            <motion.div {...fade} className="bg-card p-6 rounded-2xl border border-border text-center">
              <Users className="w-6 h-6 text-primary mx-auto mb-3" />
              <h3 className="font-bold mb-2">Consenso genitore obbligatorio</h3>
              <p className="text-xs text-muted-foreground">
                Nessuna elaborazione dati minore senza consenso certificato on-chain
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── SEZIONE 6 — CTA ── */}
        <motion.section {...fade} className="text-center py-8">
          <p className="text-lg text-muted-foreground mb-6">
            Vuoi sapere di più sulla nostra architettura tecnica?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="px-8">
              <a href="https://docs.azarlabs.com" target="_blank" rel="noopener noreferrer">
                Leggi la documentazione Azar Chain →
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8">
              <Link to="/verify">Verifica una credenziale →</Link>
            </Button>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default Security;
