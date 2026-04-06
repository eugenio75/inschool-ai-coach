const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://iylspdscllcstgfipydc.supabase.co', process.env.SUPABASE_SERVICE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});
(async () => {
  const { data } = await sb.from('user_preferences').select('profile_id, data').limit(10);
  console.log(JSON.stringify(data, null, 2));
})();
