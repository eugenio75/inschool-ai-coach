const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://iylspdscllcstgfipydc.supabase.co', process.env.SUPABASE_SERVICE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});
(async () => {
  const { data } = await sb.from('schools').select('denominazione,comune,provincia,tipo_scuola').ilike('comune','lamezia%').limit(5);
  console.log('Scuole Lamezia:', JSON.stringify(data, null, 2));
})();
