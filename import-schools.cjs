const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://iylspdscllcstgfipydc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY non impostata');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error('Uso: node import-schools.cjs /path/al/file.csv');
  process.exit(1);
}

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].replace('\r', '').split(',');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace('\r', '').trim();
    if (!line) continue;

    // Gestisce campi con virgole dentro le virgolette
    const fields = [];
    let inQuote = false;
    let current = '';
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') {
        inQuote = !inQuote;
      } else if (line[c] === ',' && !inQuote) {
        fields.push(current.trim());
        current = '';
      } else {
        current += line[c];
      }
    }
    fields.push(current.trim());

    if (fields.length < 4) continue;

    rows.push({
      codice_meccanografico: fields[0] || null,
      denominazione: fields[1] || '',
      comune: fields[2] || '',
      provincia: fields[3] || '',
      regione: fields[4] || '',
      tipo_scuola: fields[5] || '',
      indirizzo: fields[7] || '',
    });
  }
  return rows;
}

async function importSchools() {
  console.log('Lettura CSV...');
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(content);
  console.log(`Righe lette: ${rows.length}`);

  const BATCH = 500;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb
      .from('schools')
      .upsert(batch, { onConflict: 'codice_meccanografico', ignoreDuplicates: true });

    if (error) {
      console.error(`Errore batch ${i}-${i + BATCH}:`, error.message);
      errors++;
    } else {
      imported += batch.length;
      console.log(`Importate ${imported}/${rows.length} scuole...`);
    }
  }

  console.log(`\nCompletato! Importate: ${imported}, Errori: ${errors}`);
}

importSchools().catch(console.error);
