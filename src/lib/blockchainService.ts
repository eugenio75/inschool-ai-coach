/**
 * InSchool Blockchain Service
 * Unico layer che comunica con la chain privata.
 * Tutte le operazioni sono fire-and-forget (non bloccano la UI).
 * Se VITE_CHAIN_RPC_URL è vuoto → skip silenzioso di tutto.
 * MAI dati personali on-chain — solo hash HMAC.
 */

const isBlockchainConfigured = () => !!import.meta.env.VITE_CHAIN_RPC_URL;

// Simple keccak-like hash using Web Crypto API (no ethers dependency needed for hashing)
async function hmacHash(data: string): Promise<string> {
  const secret = import.meta.env.VITE_HMAC_SECRET || "default";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Tipi ──────────────────────────────────────────────────────

export interface SessionLog {
  sessionHash: string;
  timestamp: number;
  modelVersion: string;
  riskLevel: 0 | 1 | 2;
}

export interface CredentialInfo {
  subject: string;
  level: 1 | 2 | 3;
  issuedAt: number;
  institutionHash: string;
}

// ── 1. Log sessione AI on-chain ───────────────────────────────
export async function logAISession(
  userId: string,
  modelVersion: string,
  riskLevel: 0 | 1 | 2
): Promise<{ success: boolean; txHash?: string }> {
  if (!isBlockchainConfigured()) return { success: true };
  try {
    const { ethers } = await import("ethers");
    const sessionHash = "0x" + (await hmacHash(userId + Date.now().toString()));
    const modelHash = ethers.keccak256(ethers.toUtf8Bytes(modelVersion));
    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL);
    const signer = new ethers.Wallet(import.meta.env.VITE_OPERATOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      import.meta.env.VITE_GOVERNANCE_CONTRACT_ADDR,
      ["function logSession(bytes32,bytes32,uint8) external"],
      signer
    );
    const tx = await contract.logSession(sessionHash, modelHash, riskLevel);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (e) {
    console.error("[Blockchain] logAISession error:", e);
    return { success: false };
  }
}

// ── 2. Registra consenso genitore on-chain ────────────────────
export async function registerConsent(
  minorId: string,
  guardianId: string,
  scope: string,
  durationDays: number
): Promise<{ success: boolean; txHash?: string }> {
  if (!isBlockchainConfigured()) return { success: true };
  try {
    const { ethers } = await import("ethers");
    const minorHash = "0x" + (await hmacHash(minorId));
    const guardianHash = "0x" + (await hmacHash(guardianId));
    const scopeHash = ethers.keccak256(ethers.toUtf8Bytes(scope));
    const duration = durationDays * 86400;
    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL);
    const signer = new ethers.Wallet(import.meta.env.VITE_OPERATOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      import.meta.env.VITE_CONSENT_CONTRACT_ADDR,
      ["function grantConsent(bytes32,bytes32,bytes32,uint256) external"],
      signer
    );
    const tx = await contract.grantConsent(minorHash, guardianHash, scopeHash, duration);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (e) {
    console.error("[Blockchain] registerConsent error:", e);
    return { success: false };
  }
}

// ── 3. Revoca consenso ────────────────────────────────────────
export async function revokeConsent(
  minorId: string,
  guardianId: string
): Promise<{ success: boolean; txHash?: string }> {
  if (!isBlockchainConfigured()) return { success: true };
  try {
    const { ethers } = await import("ethers");
    const minorHash = "0x" + (await hmacHash(minorId));
    const guardianHash = "0x" + (await hmacHash(guardianId));
    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL);
    const signer = new ethers.Wallet(import.meta.env.VITE_OPERATOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      import.meta.env.VITE_CONSENT_CONTRACT_ADDR,
      ["function revokeConsent(bytes32,bytes32) external"],
      signer
    );
    const tx = await contract.revokeConsent(minorHash, guardianHash);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (e) {
    console.error("[Blockchain] revokeConsent error:", e);
    return { success: false };
  }
}

// ── 4. Emetti credenziale NFT Soulbound (ERC-5192) ────────────
export async function issueCredential(
  studentWalletAddr: string,
  subject: string,
  level: 1 | 2 | 3,
  studentId: string,
  sessionProof: string
): Promise<{ success: boolean; tokenId?: string; txHash?: string }> {
  if (!isBlockchainConfigured()) return { success: true };
  try {
    const { ethers } = await import("ethers");
    const studentHash = "0x" + (await hmacHash(studentId));
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(sessionProof));
    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL);
    const signer = new ethers.Wallet(import.meta.env.VITE_OPERATOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      import.meta.env.VITE_CREDENTIAL_CONTRACT_ADDR,
      ["function issueCredential(address,string,uint8,bytes32,bytes32) external returns (uint256)"],
      signer
    );
    const tx = await contract.issueCredential(studentWalletAddr, subject, level, studentHash, proofHash);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (e) {
    console.error("[Blockchain] issueCredential error:", e);
    return { success: false };
  }
}

// ── 5. Verifica credenziale (lettura pubblica) ─────────────────
export async function verifyCredential(tokenId: string): Promise<CredentialInfo | null> {
  if (!isBlockchainConfigured()) return null;
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL);
    const contract = new ethers.Contract(
      import.meta.env.VITE_CREDENTIAL_CONTRACT_ADDR,
      ["function credentials(uint256) external view returns (string,uint8,uint256,bytes32,bytes32)"],
      provider
    );
    const result = await contract.credentials(tokenId);
    return {
      subject: result[0],
      level: Number(result[1]) as 1 | 2 | 3,
      issuedAt: Number(result[2]),
      institutionHash: result[3],
    };
  } catch (e) {
    console.error("[Blockchain] verifyCredential error:", e);
    return null;
  }
}

// ── 6. Leggi log sessioni (per audit dashboard) ───────────────
export async function getSessionLogs(limit = 50): Promise<SessionLog[]> {
  if (!isBlockchainConfigured()) return [];
  try {
    if (import.meta.env.VITE_THE_GRAPH_ENDPOINT) {
      const query = `{ sessionLogs(first: ${limit}, orderBy: timestamp, orderDirection: desc) { sessionHash timestamp modelVersion riskLevel } }`;
      const res = await fetch(import.meta.env.VITE_THE_GRAPH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      return data?.data?.sessionLogs ?? [];
    }
    return [];
  } catch (e) {
    console.error("[Blockchain] getSessionLogs error:", e);
    return [];
  }
}
