import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CHAIN_API_URL = Deno.env.get("CHAIN_API_URL") ?? "";
const HMAC_SECRET   = Deno.env.get("HMAC_SECRET")   ?? "";
const CHAIN_API_KEY = Deno.env.get("CHAIN_API_KEY") ?? "";

async function anonymize(input: string): Promise<string> {
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey(
    "raw", enc.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  const hex  = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { userId, modelVersion = "inschool-coach-v2", riskLevel = 0 } =
      await req.json() as { userId: string; modelVersion?: string; riskLevel?: number };

    if (!CHAIN_API_URL || !HMAC_SECRET) {
      return Response.json({ success: true, skipped: true }, { headers: cors });
    }

    const sessionHash = await anonymize(userId + Date.now().toString());
    const modelHash   = await anonymize(modelVersion);

    const res = await fetch(`${CHAIN_API_URL}/inschool/governance/log-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CHAIN_API_KEY ? { "x-api-key": CHAIN_API_KEY } : {}),
      },
      body: JSON.stringify({ sessionHash, modelHash, riskLevel }),
    });

    const data = await res.json();
    return Response.json(
      { success: true, txHash: data.txHash, blockNumber: data.blockNumber },
      { headers: cors }
    );

  } catch (err: unknown) {
    // Mai bloccare l'app per un errore blockchain
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[blockchain-log]", msg);
    return Response.json({ success: true, error: msg }, { headers: cors });
  }
});
