import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ethers } from "ethers";

const RPC_URL = "https://rpc.azarlabs.com";
const EXPLORER_API = "https://explorer.azarlabs.com/api/v2/main-page/indexing-status";
const RBAC_ADDR = import.meta.env.VITE_RBAC_CONTRACT_ADDR || "0x8b0543690dF6dAFfCBf4c56D82778C9Ed9bb7332";
const CREDENTIAL_ADDR = import.meta.env.VITE_CREDENTIAL_CONTRACT_ADDR || "0x57457E2a5B2Aa0cE246E3873306a95277f7E341A";
const GOVERNANCE_ADDR = import.meta.env.VITE_GOVERNANCE_CONTRACT_ADDR || "0x7337DEDceedACed7Bcb52Bb552e001D71b2596a5";
const CONSENT_ADDR = import.meta.env.VITE_CONSENT_CONTRACT_ADDR || "0x74Fc0D36B46433887aE39EA9B43b67f642d5715a";
const OPERATOR = "0x4740749b80F4092413161fB5307E301cAf8E0718";

interface TestResult {
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  ms?: number;
  detail?: string;
}

const initialTests: TestResult[] = [
  { name: "Connessione RPC (eth_chainId)", status: "pending" },
  { name: "RBAC Contract raggiungibile", status: "pending" },
  { name: "CredentialNFT — balanceOf operator", status: "pending" },
  { name: "GovernanceLog — contratto risponde", status: "pending" },
  { name: "ConsentRegistry — contratto risponde", status: "pending" },
  { name: "Explorer API raggiungibile", status: "pending" },
];

async function runTest(index: number): Promise<Partial<TestResult>> {
  const start = performance.now();
  const provider = new ethers.JsonRpcProvider(RPC_URL, 24780);

  try {
    switch (index) {
      case 0: {
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        if (chainId !== 24780) throw new Error(`Chain ID: ${chainId}, atteso 24780 (0x60cc)`);
        return { status: "pass", ms: performance.now() - start, detail: `Chain ID: ${chainId} (0x${chainId.toString(16)})` };
      }
      case 1: {
        const rbac = new ethers.Contract(RBAC_ADDR, ["function hasRole(bytes32, address) view returns (bool)"], provider);
        const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
        await rbac.hasRole(DEFAULT_ADMIN, OPERATOR);
        return { status: "pass", ms: performance.now() - start, detail: "hasRole chiamata OK" };
      }
      case 2: {
        const cred = new ethers.Contract(CREDENTIAL_ADDR, ["function balanceOf(address) view returns (uint256)"], provider);
        const balance = await cred.balanceOf(OPERATOR);
        return { status: "pass", ms: performance.now() - start, detail: `Balance: ${balance.toString()}` };
      }
      case 3: {
        const code = await provider.getCode(GOVERNANCE_ADDR);
        if (code === "0x") throw new Error("Nessun bytecode trovato");
        return { status: "pass", ms: performance.now() - start, detail: `Bytecode: ${code.slice(0, 20)}...` };
      }
      case 4: {
        const code = await provider.getCode(CONSENT_ADDR);
        if (code === "0x") throw new Error("Nessun bytecode trovato");
        return { status: "pass", ms: performance.now() - start, detail: `Bytecode: ${code.slice(0, 20)}...` };
      }
      case 5: {
        const res = await fetch(EXPLORER_API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { status: "pass", ms: performance.now() - start, detail: JSON.stringify(data).slice(0, 100) };
      }
      default:
        return { status: "fail", detail: "Test sconosciuto" };
    }
  } catch (err: any) {
    return { status: "fail", ms: performance.now() - start, detail: err?.message || String(err) };
  }
}

export default function BlockchainTest() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestResult[]>(initialTests);
  const [running, setRunning] = useState(false);

  const runSingle = async (index: number) => {
    setTests((prev) => prev.map((t, i) => (i === index ? { ...t, status: "running" } : t)));
    const result = await runTest(index);
    setTests((prev) => prev.map((t, i) => (i === index ? { ...t, ...result } : t)));
  };

  const runAll = async () => {
    setRunning(true);
    for (let i = 0; i < tests.length; i++) {
      setTests((prev) => prev.map((t, j) => (j === i ? { ...t, status: "running" } : t)));
      const result = await runTest(i);
      setTests((prev) => prev.map((t, j) => (j === i ? { ...t, ...result } : t)));
    }
    setRunning(false);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "pass": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "fail": return <XCircle className="w-5 h-5 text-destructive" />;
      case "running": return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">🔗 Blockchain Test — Azar Chain</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6">
          <Button onClick={runAll} disabled={running} className="rounded-xl gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Esegui tutti i test
          </Button>
          <Button variant="outline" onClick={() => setTests(initialTests)} className="rounded-xl gap-2">
            <RefreshCw className="w-4 h-4" /> Reset
          </Button>
        </div>

        <div className="space-y-3">
          {tests.map((test, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <StatusIcon status={test.status} />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{test.name}</p>
                    {test.detail && (
                      <p className={`text-xs mt-0.5 ${test.status === "fail" ? "text-destructive" : "text-muted-foreground"}`}>
                        {test.detail}
                      </p>
                    )}
                  </div>
                  {test.ms !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">{Math.round(test.ms)}ms</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runSingle(i)}
                  disabled={test.status === "running"}
                  className="ml-2"
                >
                  <Play className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
          <p className="text-xs text-muted-foreground">
            <strong>RPC:</strong> {RPC_URL} · <strong>Chain ID:</strong> 24780 (0x60cc)<br />
            <strong>Contracts:</strong> RBAC {RBAC_ADDR.slice(0, 10)}... · Credential {CREDENTIAL_ADDR.slice(0, 10)}... · Governance {GOVERNANCE_ADDR.slice(0, 10)}... · Consent {CONSENT_ADDR.slice(0, 10)}...
          </p>
        </div>
      </div>
    </div>
  );
}
