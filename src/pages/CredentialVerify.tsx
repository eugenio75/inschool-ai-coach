import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ShieldCheck, ShieldX, Upload, Search, Camera, Download,
  ExternalLink, Loader2, CheckCircle2, XCircle, ChevronDown,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { verifyCredential, type CredentialInfo } from "@/lib/blockchainService";


type VerifyState = "idle" | "loading" | "found" | "not_found" | "unavailable";

const levelLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Bronze", color: "text-amber-700 bg-amber-50 border-amber-200" },
  2: { label: "Silver", color: "text-slate-600 bg-slate-50 border-slate-200" },
  3: { label: "Gold", color: "text-yellow-700 bg-yellow-50 border-yellow-300" },
};

export default function CredentialVerify() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<VerifyState>("idle");
  const [credential, setCredential] = useState<CredentialInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Bulk verify
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResults, setBulkResults] = useState<
    { name: string; code: string; found: boolean; credential?: CredentialInfo }[]
  >([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setState("loading");
    try {
      const result = await verifyCredential(trimmed);
      if (result) {
        setCredential(result);
        setState("found");
      } else {
        // Check if blockchain is configured
        if (!import.meta.env.VITE_CHAIN_RPC_URL) {
          setState("unavailable");
        } else {
          setState("not_found");
        }
      }
    } catch {
      setState("unavailable");
    }
  };

  const startQrScan = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setScanning(true);
    } catch {
      // Camera not available — graceful degradation
    }
  };

  const stopQrScan = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setScanning(false);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  const handleBulkUpload = async (file: File) => {
    setBulkFile(file);
    setBulkLoading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const results = [];
      // Skip header if present
      const startIdx = lines[0]?.toLowerCase().includes("nome") ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        const name = parts[0] || "";
        const credCode = parts[1] || "";
        if (!credCode) continue;
        const result = await verifyCredential(credCode);
        results.push({
          name,
          code: credCode,
          found: !!result,
          credential: result || undefined,
        });
      }
      setBulkResults(results);
    } catch {
      setBulkResults([]);
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadBulkCSV = () => {
    const header = "nome,codice,stato,materia,livello,data_emissione\n";
    const rows = bulkResults
      .map(
        (r) =>
          `${r.name},${r.code},${r.found ? "Verificato" : "Non trovato"},${r.credential?.subject || ""},${r.credential ? levelLabels[r.credential.level]?.label : ""},${r.credential ? new Date(r.credential.issuedAt * 1000).toLocaleDateString("it-IT") : ""}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verifiche_credenziali.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <FloatingBackButton />

      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-foreground">InSchool</span>
          </div>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Accedi
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
          >
            <ShieldCheck className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Verifica una credenziale InSchool
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Inserisci il codice della credenziale o scansiona il QR per verificare in tempo reale.
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Inserisci codice credenziale..."
            className="rounded-xl text-base"
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
          <Button onClick={handleVerify} disabled={state === "loading" || !code.trim()} className="rounded-xl px-6">
            {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex justify-center mb-10">
          {!scanning ? (
            <button
              onClick={startQrScan}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Camera className="w-4 h-4" /> Scansiona QR
            </button>
          ) : (
            <div className="w-full max-w-sm">
              <video ref={videoRef} className="w-full rounded-xl border border-border" />
              <Button onClick={stopQrScan} variant="ghost" size="sm" className="mt-2 w-full">
                Chiudi fotocamera
              </Button>
            </div>
          )}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {state === "found" && credential && (
            <motion.div
              key="found"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 print:shadow-none"
            >
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </motion.div>
                <span className="font-semibold text-primary">Credenziale verificata</span>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground">Materia</p>
                  <p className="font-semibold text-foreground">{credential.subject}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Livello</p>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${levelLabels[credential.level]?.color || ""}`}
                    >
                      {levelLabels[credential.level]?.label || "N/A"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data emissione</p>
                    <p className="text-sm text-foreground">
                      {new Date(credential.issuedAt * 1000).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 mb-6 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">Verificato su InSchool Blockchain</span>
              </div>

              <div className="flex gap-3">
                <Button onClick={handlePrintCertificate} variant="outline" className="rounded-xl flex-1">
                  <Download className="w-4 h-4 mr-2" /> Scarica certificato
                </Button>
                {import.meta.env.VITE_CHAIN_EXPLORER_URL && (
                  <Button asChild variant="ghost" className="rounded-xl">
                    <a
                      href={`${import.meta.env.VITE_CHAIN_EXPLORER_URL}/tx/${code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> On-chain
                    </a>
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {state === "not_found" && (
            <motion.div
              key="not_found"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 text-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
              </motion.div>
              <p className="text-foreground font-semibold mb-1">Nessuna credenziale trovata</p>
              <p className="text-sm text-muted-foreground">
                Verifica di aver inserito il codice corretto.
              </p>
            </motion.div>
          )}

          {state === "unavailable" && (
            <motion.div
              key="unavailable"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 text-center"
            >
              <ShieldX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-semibold mb-1">Servizio temporaneamente non disponibile</p>
              <p className="text-sm text-muted-foreground">
                Il servizio di verifica blockchain non è ancora configurato. Riprova più tardi.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk verification */}
        <div className="mt-16">
          <Accordion type="single" collapsible>
            <AccordionItem value="bulk">
              <AccordionTrigger className="text-sm font-medium">
                Verifica multipla per aziende e università
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Carica un file CSV con colonne: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">nome, codice_credenziale</code>
                  </p>

                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      id="bulk-csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBulkUpload(file);
                      }}
                    />
                    <label htmlFor="bulk-csv" className="cursor-pointer">
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {bulkFile ? bulkFile.name : "Clicca per caricare CSV"}
                      </p>
                    </label>
                  </div>

                  {bulkLoading && (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Verifica in corso...</span>
                    </div>
                  )}

                  {bulkResults.length > 0 && (
                    <>
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Codice</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Stato</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkResults.map((r, i) => (
                              <tr key={i} className="border-t border-border">
                                <td className="px-3 py-2 text-foreground">{r.name}</td>
                                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{r.code}</td>
                                <td className="px-3 py-2">
                                  {r.found ? (
                                    <span className="text-primary flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Verificato
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <XCircle className="w-3.5 h-3.5" /> Non trovato
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Button onClick={downloadBulkCSV} variant="outline" className="rounded-xl w-full">
                        <Download className="w-4 h-4 mr-2" /> Scarica risultati CSV
                      </Button>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-16">
        <p className="text-center text-xs text-muted-foreground">
          Nessun dato personale viene memorizzato &middot; Conforme EU AI Act &middot; &copy; InSchool
        </p>
      </footer>
    </div>
  );
}
