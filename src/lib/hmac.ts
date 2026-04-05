/**
 * SarAI × Azar Chain — Anonimizzazione HMAC
 *
 * Trasforma qualsiasi ID in un hash bytes32 irreversibile.
 * Usato per garantire che nessun dato personale vada on-chain.
 * Output sempre in formato: 0x + 64 caratteri hex (bytes32 EVM)
 */

const HMAC_SECRET = import.meta.env.VITE_HMAC_SECRET || 'default-dev-secret';

/**
 * Genera hash HMAC-SHA256 async (preferita — usa Web Crypto API nativa).
 */
export async function anonymize(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(HMAC_SECRET);
  const inputData = encoder.encode(input);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, inputData);
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return '0x' + hex;
}

/**
 * Genera hash deterministico sync (per contesti non-async).
 * Meno sicuro di anonymize() — usare solo dove strettamente necessario.
 */
export function anonymizeSync(input: string): string {
  let hash = 0;
  const str = HMAC_SECRET + input;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
}
