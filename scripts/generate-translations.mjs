import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENAI_KEY = process.env.VITE_OPENAI_API_KEY;
const LANGS = ['es', 'fr', 'de', 'ar'];
const LANG_NAMES = { es: 'Spanish', fr: 'French', de: 'German', ar: 'Arabic' };

const itPath = path.join(__dirname, '../src/locales/it.json');
const itBundle = JSON.parse(fs.readFileSync(itPath, 'utf8'));

async function translateChunk(texts, targetLang) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Translate these Italian UI strings to ${LANG_NAMES[targetLang]}. Return ONLY a valid JSON array of strings, same order, same length. Keep "InSchool" untranslated. Keep placeholders like {{name}} unchanged. Keep short and concise.`
        },
        { role: 'user', content: JSON.stringify(texts) }
      ]
    })
  });
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  const match = content.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : texts;
}

async function translateLang(lang) {
  const outPath = path.join(__dirname, `../src/locales/${lang}.json`);
  
  // Skip if already exists and not forced
  if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
    console.log(`[${lang}] Already exists, skipping. Use --force to regenerate.`);
    return;
  }

  console.log(`[${lang}] Translating ${Object.keys(itBundle).length} keys...`);
  
  const keys = Object.keys(itBundle);
  const texts = keys.map(k => itBundle[k]);
  const chunkSize = 60;
  const result = {};
  
  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunk = texts.slice(i, i + chunkSize);
    const chunkKeys = keys.slice(i, i + chunkSize);
    console.log(`  [${lang}] Chunk ${Math.floor(i/chunkSize)+1}/${Math.ceil(texts.length/chunkSize)}...`);
    try {
      const translated = await translateChunk(chunk, lang);
      chunkKeys.forEach((key, idx) => {
        result[key] = translated[idx] || itBundle[key];
      });
    } catch(e) {
      console.error(`  [${lang}] Chunk failed:`, e.message);
      chunkKeys.forEach(key => { result[key] = itBundle[key]; });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`[${lang}] Done → ${outPath}`);
}

// Find actual locales path
const possiblePaths = [
  '../src/locales/it.json',
  '../src/locales/it.json',
  '../public/locales/it/translation.json',
];

let actualItPath = null;
for (const p of possiblePaths) {
  const full = path.join(__dirname, p);
  if (fs.existsSync(full)) { actualItPath = full; break; }
}

if (!actualItPath) {
  // Search for it.json
  const found = [];
  function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory() && !fp.includes('node_modules') && !fp.includes('.git')) walk(fp);
      else if (f === 'it.json') found.push(fp);
    }
  }
  walk(path.join(__dirname, '../src'));
  if (found.length) { actualItPath = found[0]; console.log('Found it.json at:', actualItPath); }
}

if (!actualItPath) { console.error('Cannot find it.json'); process.exit(1); }

const itDir = path.dirname(actualItPath);
const itBundleFinal = JSON.parse(fs.readFileSync(actualItPath, 'utf8'));

async function run() {
  for (const lang of LANGS) {
    const outPath = path.join(itDir, `${lang}.json`);
    if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
      console.log(`[${lang}] Already exists, skipping.`);
      continue;
    }
    console.log(`\n[${lang}] Translating ${Object.keys(itBundleFinal).length} keys to ${LANG_NAMES[lang]}...`);
    const keys = Object.keys(itBundleFinal);
    const texts = keys.map(k => itBundleFinal[k]);
    const chunkSize = 60;
    const result = {};
    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const chunkKeys = keys.slice(i, i + chunkSize);
      console.log(`  Chunk ${Math.floor(i/chunkSize)+1}/${Math.ceil(texts.length/chunkSize)}`);
      try {
        const translated = await translateChunk(chunk, lang);
        chunkKeys.forEach((key, idx) => { result[key] = translated[idx] || itBundleFinal[key]; });
      } catch(e) {
        console.error(`  Chunk failed:`, e.message);
        chunkKeys.forEach(key => { result[key] = itBundleFinal[key]; });
      }
      await new Promise(r => setTimeout(r, 300));
    }
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[${lang}] Saved to ${outPath}`);
  }
  console.log('\nAll translations done!');
}

run().catch(console.error);
