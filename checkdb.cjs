const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://iylspdscllcstgfipydc.supabase.co', process.env.SUPABASE_SERVICE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});
(async () => {
  const { data: s1, error: e1 } = await sb.from('scuole_italia').select('id').limit(1);
  console.log('scuole_italia:', e1 ? 'ERRORE: '+e1.message : 'OK - '+JSON.stringify(s1));
  const { data: s2, error: e2 } = await sb.from('schools').select('id,denominazione,comune').limit(3);
  console.log('schools:', e2 ? 'ERRORE: '+e2.message : 'OK - '+JSON.stringify(s2));
})();
