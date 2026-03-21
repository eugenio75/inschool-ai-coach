/**
 * InSchool Blockchain Service — Deno Edge Function version
 * Fire-and-forget logging of AI sessions on private chain.
 * If env vars are missing → skip silently.
 * No personal data on-chain — only HMAC hashes.
 */

import { ethers } from "npm:ethers@6";

const isConfigured = () => !!Deno.env.get("VITE_CHAIN_RPC_URL");

function hmac(data: string): string {
  const secret = Deno.env.get("VITE_HMAC_SECRET") || "default";
  return ethers.keccak256(ethers.toUtf8Bytes(secret + data));
}

function getProvider() {
  return new ethers.JsonRpcProvider(Deno.env.get("VITE_CHAIN_RPC_URL"));
}

function getSigner() {
  return new ethers.Wallet(Deno.env.get("VITE_OPERATOR_PRIVATE_KEY")!, getProvider());
}

export async function logAISession(
  userId: string,
  modelVersion: string,
  riskLevel: 0 | 1 | 2
): Promise<{ success: boolean; txHash?: string }> {
  if (!isConfigured()) return { success: true };
  try {
    const sessionHash = hmac(userId + Date.now().toString());
    const modelHash = ethers.keccak256(ethers.toUtf8Bytes(modelVersion));
    const signer = getSigner();
    const contract = new ethers.Contract(
      Deno.env.get("VITE_GOVERNANCE_CONTRACT_ADDR")!,
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
