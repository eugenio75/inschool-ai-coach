import { useState, useEffect } from "react";
import { Shield, Copy, Check, ExternalLink, Loader2, Coins, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ethers } from "ethers";
import { anonymize } from "@/lib/hmac";

const RPC_URL = "https://rpc.azarlabs.com";
const CHAIN_ID = 24780;
const EXPLORER = import.meta.env.VITE_CHAIN_EXPLORER_URL || "https://explorer.azarlabs.com";
const CREDENTIAL_ADDR = import.meta.env.VITE_CREDENTIAL_CONTRACT_ADDR || "0x57457E2a5B2Aa0cE246E3873306a95277f7E341A";
const GOVERNANCE_ADDR = import.meta.env.VITE_GOVERNANCE_CONTRACT_ADDR || "0x7337DEDceedACed7Bcb52Bb552e001D71b2596a5";
const CONSENT_ADDR = import.meta.env.VITE_CONSENT_CONTRACT_ADDR || "0x74Fc0D36B46433887aE39EA9B43b67f642d5715a";
const HMAC_SECRET = import.meta.env.VITE_HMAC_SECRET || "default-dev-secret";

const CREDENTIAL_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
];

const GOVERNANCE_ABI = [
  "event LogEntry(address indexed user, string action, string data, uint256 timestamp)",
];

const CONSENT_ABI = [
  "event ConsentRecorded(address indexed guardian, address indexed minor, bool consent, uint256 timestamp)",
];

interface BlockchainTabProps {
  userId: string;
}

function deriveWallet(userId: string): ethers.Wallet {
  // Deterministic private key from HMAC of userId
  const encoder = new TextEncoder();
  const data = encoder.encode(HMAC_SECRET + userId);
  // Use a simple deterministic hash for the private key
  const hashHex = ethers.keccak256(data);
  return new ethers.Wallet(hashHex);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiato!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <code className="text-xs font-mono text-muted-foreground">{hash.slice(0, 10)}...{hash.slice(-8)}</code>
      <CopyButton text={hash} />
      <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

export function BlockchainTab({ userId }: BlockchainTabProps) {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);
  const [address, setAddress] = useState("");
  const [credentialCount, setCredentialCount] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{ tokenId: string; uri: string }[]>([]);
  const [governanceLogs, setGovernanceLogs] = useState<any[]>([]);
  const [consentLogs, setConsentLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const w = deriveWallet(userId);
        setWallet(w);
        setAddress(w.address);

        const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

        // Credentials
        try {
          const credContract = new ethers.Contract(CREDENTIAL_ADDR, CREDENTIAL_ABI, provider);
          const balance = await credContract.balanceOf(w.address);
          const count = Number(balance);
          setCredentialCount(count);

          const creds: { tokenId: string; uri: string }[] = [];
          for (let i = 0; i < Math.min(count, 10); i++) {
            try {
              const tokenId = await credContract.tokenOfOwnerByIndex(w.address, i);
              let uri = "";
              try { uri = await credContract.tokenURI(tokenId); } catch {}
              creds.push({ tokenId: tokenId.toString(), uri });
            } catch { break; }
          }
          setCredentials(creds);
        } catch (err) {
          console.debug("[Blockchain] Credential fetch:", err);
        }

        // Governance logs
        try {
          const govContract = new ethers.Contract(GOVERNANCE_ADDR, GOVERNANCE_ABI, provider);
          const userHash = await anonymize(userId);
          const filter = govContract.filters.LogEntry(userHash);
          const events = await govContract.queryFilter(filter, -10000);
          setGovernanceLogs(events.slice(-20).reverse().map((e: any) => ({
            action: e.args?.action,
            data: e.args?.data,
            timestamp: Number(e.args?.timestamp),
            txHash: e.transactionHash,
          })));
        } catch (err) {
          console.debug("[Blockchain] Governance fetch:", err);
        }

        // Consent logs
        try {
          const consentContract = new ethers.Contract(CONSENT_ADDR, CONSENT_ABI, provider);
          const userHash = await anonymize(userId);
          const filterGuardian = consentContract.filters.ConsentRecorded(userHash);
          const filterMinor = consentContract.filters.ConsentRecorded(null, userHash);
          const [eventsG, eventsM] = await Promise.all([
            consentContract.queryFilter(filterGuardian, -10000),
            consentContract.queryFilter(filterMinor, -10000),
          ]);
          const all = [...eventsG, ...eventsM];
          setConsentLogs(all.slice(-10).reverse().map((e: any) => ({
            consent: e.args?.consent,
            timestamp: Number(e.args?.timestamp),
            txHash: e.transactionHash,
          })));
        } catch (err) {
          console.debug("[Blockchain] Consent fetch:", err);
        }
      } catch (err) {
        setError("Impossibile connettersi ad Azar Chain");
        console.error("[Blockchain] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) load();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Le tue credenziali su Azar Chain
        </h3>
        {error && <p className="text-sm text-destructive mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Indirizzo wallet</p>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
              <code className="text-sm font-mono text-foreground break-all flex-1">{address}</code>
              <CopyButton text={address} />
              <a
                href={`${EXPLORER}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Chain: Azar Chain · ID {CHAIN_ID} · <a href={EXPLORER} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Explorer</a>
          </p>
        </div>
      </div>

      {/* Credentials NFT */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" /> Credenziali NFT
        </h3>
        {credentialCount === null || credentialCount === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna credenziale NFT trovata per questo wallet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-2">{credentialCount} credenzial{credentialCount === 1 ? "e" : "i"} trovat{credentialCount === 1 ? "a" : "e"}</p>
            {credentials.map((c) => (
              <div key={c.tokenId} className="p-3 bg-muted/50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Token #{c.tokenId}</span>
                  {c.uri && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.uri}</p>}
                </div>
                <a
                  href={`${EXPLORER}/token/${CREDENTIAL_ADDR}/instance/${c.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Governance Logs */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Log di Governance
        </h3>
        {governanceLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun log di governance trovato.</p>
        ) : (
          <div className="space-y-2">
            {governanceLogs.map((log, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{log.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {log.timestamp ? new Date(log.timestamp * 1000).toLocaleDateString("it-IT") : ""}
                  </span>
                </div>
                {log.txHash && <TxLink hash={log.txHash} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consent Logs */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Consensi Registrati
        </h3>
        {consentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun consenso registrato trovato.</p>
        ) : (
          <div className="space-y-2">
            {consentLogs.map((log, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${log.consent ? "text-green-600" : "text-destructive"}`}>
                    {log.consent ? "✅ Consenso concesso" : "❌ Consenso revocato"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {log.timestamp ? new Date(log.timestamp * 1000).toLocaleDateString("it-IT") : ""}
                  </span>
                </div>
                {log.txHash && <TxLink hash={log.txHash} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
