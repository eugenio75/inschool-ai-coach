// Migration via Supabase pg-proxy endpoint (disponibile su piani Pro)
// o via fetch alle funzioni Edge che già esistono nel progetto
// Strategia finale: creare le tabelle una ad una via Supabase REST
// usando operazioni che non richiedono SQL diretto

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://iylspdscllcstgfipydc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bHNwZHNjbGxjc3RnZmlweWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDY1MzUsImV4cCI6MjA4OTQyMjUzNX0.T46KVbBQM_sPbCxCLPpMIaecR3LtfbN5ywchHA1JcuA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verifichiamo quali tabelle esistono già
async function tableExists(tableName) {
  const { data, error } = await supabase.from(tableName).select('id').limit(1);
  // Se error.code === 'PGRST204' la tabella esiste ma è vuota
  // Se error.code === '42P01' la tabella non esiste
  if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
    return false;
  }
  return true;
}

async function main() {
  console.log('Verifica tabelle esistenti su Supabase...');
  
  const tables = [
    'sessioni_studio',
    'esami_utente', 
    'classi',
    'verifiche',
    'ricerche_bibliografiche',
    'user_preferences',
  ];
  
  const results = [];
  for (const t of tables) {
    const exists = await tableExists(t);
    console.log(`  ${t}: ${exists ? 'GIA PRESENTE' : 'DA CREARE'}`);
    results.push({ table: t, exists });
  }
  
  const missing = results.filter(r => !r.exists).map(r => r.table);
  
  if (missing.length === 0) {
    console.log('\nTutte le tabelle esistono gia! Nessuna migration necessaria.');
  } else {
    console.log(`\nTabelle da creare: ${missing.join(', ')}`);
    console.log('\nPer applicare la migration, incolla il seguente SQL nel Supabase Dashboard SQL Editor:');
    console.log('\nhttps://supabase.com/dashboard/project/iylspdscllcstgfipydc/sql/new\n');
    console.log('Il file SQL e disponibile in: supabase/migrations/20260318203100_adult_tables.sql');
  }
  
  // Test di scrittura su tabelle presenti
  console.log('\nTest connessione Supabase...');
  const { data, error } = await supabase.from('child_profiles').select('id').limit(1);
  if (error) {
    console.log('Connessione: ERRORE -', error.message);
  } else {
    console.log('Connessione: OK - child_profiles accessibile');
  }
}

main();
