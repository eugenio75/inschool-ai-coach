const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, city } = await req.json();

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query MIUR open data API for schools
    const encodedQuery = encodeURIComponent(query);
    const miurUrl = `https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?q=${encodedQuery}`;
    
    let miurResults: any[] = [];
    try {
      const response = await fetch(miurUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        miurResults = Array.isArray(data) ? data.slice(0, 10) : [];
      }
    } catch {
      // MIUR API may not be available, use fallback
      console.log('MIUR API not reachable, using fallback matching');
    }

    // If MIUR returned results, format them
    if (miurResults.length > 0) {
      const formatted = miurResults.map((s: any) => ({
        name: s.DENOMINAZIONESCUOLA || s.nome || s.denominazione || query,
        city: s.DESCRIZIONECOMUNE || s.comune || city || '',
        code: s.CODICESCUOLA || s.codice || '',
        verified: true,
      }));
      return new Response(
        JSON.stringify({ results: formatted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: return the query as unverified
    return new Response(
      JSON.stringify({ results: [{ name: query, city: city || '', code: '', verified: false }] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
