/**
 * SarAI × Azar Chain — Blockchain Service
 *
 * Unico punto di comunicazione con la blockchain dall'app.
 * Chiama il backend API di Azar Chain via fetch() — nessuna libreria blockchain.
 * La firma delle transazioni avviene LATO BACKEND (sicuro per produzione).
 * Tutte le operazioni sono fire-and-forget — non bloccano mai la UI.
 * Se VITE_CHAIN_API_URL è vuoto → skip silenzioso, app funziona normalmente.
 *
 * Chain: Azar Chain — Chain ID 24780 — rpc.azarlabs.com
 * Backend: api-chain.azarlabs.com (Docker container azar-api-chain)
 */

import { anonymize } from './hmac';

// ── Configurazione ────────────────────────────────────────────────────────────
const API_URL  = import.meta.env.VITE_CHAIN_API_URL     || '';
const API_KEY  = import.meta.env.VITE_CHAIN_API_KEY     || '';
const EXPLORER = import.meta.env.VITE_CHAIN_EXPLORER_URL || 'https://explorer.azarlabs.com';

// Indirizzi contratti (per link explorer)
const CREDENTIAL_ADDR = import.meta.env.VITE_CREDENTIAL_CONTRACT_ADDR ||
  '0x57457E2a5B2Aa0cE246E3873306a95277f7E341A';

const isConfigured = (): boolean => !!API_URL;

// ── Helper HTTP ───────────────────────────────────────────────────────────────
async function apiCall<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!isConfigured()) return { success: true };

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    return { success: true, data: await res.json() as T };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.debug('[Chain] API error:', msg);
    return { success: false, error: msg };
  }
}

// ── Tipi ──────────────────────────────────────────────────────────────────────
export interface BlockchainResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
  skipped?: boolean;
}

export interface CredentialInfo {
  tokenId: string;
  subject: string;
  level: 1 | 2 | 3;
  issuedAt: number;
  verified: boolean;
  explorerUrl: string;
}

export interface ChainHealth {
  online: boolean;
  blockNumber?: number;
  chainId?: number;
}

// ── 1. LOG SESSIONE AI ────────────────────────────────────────────────────────
/**
 * Loga una sessione AI on-chain.
 * userId viene anonimizzato via HMAC — mai l'ID reale on-chain.
 * Fire-and-forget: non blocca mai la UI.
 */
export async function logAISession(
  userId: string,
  modelVersion = 'inschool-coach-v2',
  riskLevel: 0 | 1 | 2 = 0
): Promise<BlockchainResult> {
  if (!isConfigured()) return { success: true, skipped: true };
  try {
    const sessionHash = await anonymize(userId + Date.now());
    const modelHash   = await anonymize(modelVersion);
    const result = await apiCall<{ txHash: string; blockNumber: number }>(
      'POST', '/inschool/governance/log-session',
      { sessionHash, modelHash, riskLevel }
    );
    if (result.success && result.data?.txHash) {
      console.debug('[Chain] SessionLogged:', result.data.txHash);
    }
    return { success: result.success, txHash: result.data?.txHash, error: result.error };
  } catch { return { success: false }; }
}

// ── 2. REGISTRA CONSENSO GENITORE ─────────────────────────────────────────────
/**
 * Registra il consenso genitoriale on-chain.
 * Chiamata dal Parent Guardian Portal.
 */
export async function registerConsent(
  minorUserId: string,
  guardianUserId: string,
  scope = 'full',
  durationDays = 365
): Promise<BlockchainResult> {
  if (!isConfigured()) return { success: true, skipped: true };
  try {
    const minorHash    = await anonymize(minorUserId);
    const guardianHash = await anonymize(guardianUserId);
    const scopeHash    = await anonymize(scope);
    const result = await apiCall<{ txHash: string }>(
      'POST', '/inschool/consent/grant',
      { minorHash, guardianHash, scope: scopeHash, durationSeconds: durationDays * 86400 }
    );
    return { success: result.success, txHash: result.data?.txHash, error: result.error };
  } catch { return { success: false }; }
}

// ── 3. REVOCA CONSENSO ────────────────────────────────────────────────────────
/**
 * Revoca il consenso genitoriale on-chain.
 * Chiamata dal bottone "Revoca tutti i permessi".
 */
export async function revokeConsent(
  minorUserId: string,
  guardianUserId: string
): Promise<BlockchainResult> {
  if (!isConfigured()) return { success: true, skipped: true };
  try {
    const minorHash    = await anonymize(minorUserId);
    const guardianHash = await anonymize(guardianUserId);
    const result = await apiCall<{ txHash: string }>(
      'POST', '/inschool/consent/revoke',
      { minorHash, guardianHash }
    );
    return { success: result.success, txHash: result.data?.txHash, error: result.error };
  } catch { return { success: false }; }
}

// ── 4. VERIFICA CONSENSO VALIDO ───────────────────────────────────────────────
export async function isConsentValid(minorUserId: string): Promise<boolean> {
  if (!isConfigured()) return true;
  try {
    const minorHash = await anonymize(minorUserId);
    const result = await apiCall<{ valid: boolean }>('GET', `/inschool/consent-valid/${minorHash}`);
    return result.data?.valid ?? true;
  } catch { return true; }
}

// ── 5. EMETTI CREDENZIALE BADGE (Soulbound NFT) ───────────────────────────────
/**
 * Emette un ERC-5192 Soulbound Token per una competenza raggiunta.
 * level: 1=Bronze, 2=Silver, 3=Gold
 */
export async function issueCredential(
  studentWalletAddress: string,
  subject: string,
  level: 1 | 2 | 3,
  studentUserId: string,
  sessionTxHash = ''
): Promise<BlockchainResult & { tokenId?: string }> {
  if (!isConfigured()) return { success: true, skipped: true };
  try {
    const studentHash  = await anonymize(studentUserId);
    const sessionProof = await anonymize(sessionTxHash || 'no-proof');
    const result = await apiCall<{ txHash: string; tokenId: string }>(
      'POST', '/inschool/credential/issue',
      { to: studentWalletAddress, subject, level, studentHash, sessionProof }
    );
    return { success: result.success, txHash: result.data?.txHash, tokenId: result.data?.tokenId };
  } catch { return { success: false }; }
}

// ── 6. VERIFICA CREDENZIALE PUBBLICA ─────────────────────────────────────────
/**
 * Legge una credenziale on-chain — usata dalla pagina pubblica /verify.
 * Non richiede autenticazione.
 */
export async function verifyCredential(tokenId: string): Promise<CredentialInfo | null> {
  if (!API_URL) return null;
  try {
    const result = await apiCall<{ subject: string; level: number; issuedAt: number }>(
      'GET', `/inschool/credential/${tokenId}`
    );
    if (!result.success || !result.data) return null;
    return {
      tokenId,
      subject:     result.data.subject,
      level:       result.data.level as 1 | 2 | 3,
      issuedAt:    result.data.issuedAt,
      verified:    true,
      explorerUrl: `${EXPLORER}/token/${CREDENTIAL_ADDR}/instance/${tokenId}`,
    };
  } catch { return null; }
}

// ── 7. HEALTH CHECK ───────────────────────────────────────────────────────────
export async function checkChainHealth(): Promise<ChainHealth> {
  if (!API_URL) return { online: false };
  try {
    const result = await apiCall<{ blockNumber: string; chainId: string }>('GET', '/health');
    if (result.success && result.data) {
      return {
        online: true,
        blockNumber: parseInt(result.data.blockNumber),
        chainId: parseInt(result.data.chainId),
      };
    }
    return { online: false };
  } catch { return { online: false }; }
}

// ── Helpers URL ───────────────────────────────────────────────────────────────
export const getExplorerTxUrl    = (hash: string)    => `${EXPLORER}/tx/${hash}`;
export const getExplorerTokenUrl = (tokenId: string) =>
  `${EXPLORER}/token/${CREDENTIAL_ADDR}/instance/${tokenId}`;
