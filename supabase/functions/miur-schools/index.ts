import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Query the local schools table via search_schools function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('search_schools', {
      query: query,
      limit_n: 10,
    });

    if (error) {
      console.error('search_schools error:', error);
      // Fallback: return query as unverified
      return new Response(
        JSON.stringify({ results: [{ name: query, city: city || '', code: '', verified: false }] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data && data.length > 0) {
      const formatted = data.map((s: any) => ({
        name: s.denominazione,
        city: s.comune || city || '',
        code: s.codice_meccanografico || '',
        provincia: s.provincia || '',
        tipo_scuola: s.tipo_scuola || '',
        verified: true,
      }));
      return new Response(
        JSON.stringify({ results: formatted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No results: return the query as unverified
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
