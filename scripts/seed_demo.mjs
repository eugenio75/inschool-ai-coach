import fs from 'fs';
import path from 'path';

// Parse .env if it exists per avere le chiavi reali di produzione/local, altrimenti usa quelle hardcoded
const envPath = path.join(process.cwd(), '.env');
let supabaseUrl = "https://iylspdscllcstgfipydc.supabase.co";
let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bHNwZHNjbGxjc3RnZmlweWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDY1MzUsImV4cCI6MjA4OTQyMjUzNX0.T46KVbBQM_sPbCxCLPpMIaecR3LtfbN5ywchHA1JcuA";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      if (match[1].trim() === 'VITE_SUPABASE_URL') supabaseUrl = match[2].trim().replace(/^['"]|['"]$/g, '');
      // VITE_SUPABASE_ANON_KEY (o equivalent)
      if (match[1].trim() === 'VITE_SUPABASE_PUBLISHABLE_KEY') supabaseKey = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (match[1].trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const accounts = [
  { 
    email: "demo.alunno@inschool.com", password: "123456", role: "alunno", name: "Alunno Demo", age: 9, 
    prefs: { onboarding_completed: true, favorite_subjects: ["Matematica"], difficult_subjects: ["Storia"] }
  },
  { 
    email: "demo.genitore@inschool.com", password: "123456", role: "genitore", name: "Genitore Demo", age: 40,
    prefs: { onboarding_completed: true } 
  },
  { 
    email: "demo.superiori@inschool.com", password: "123456", role: "superiori", name: "Studente Sperimentale", age: 17,
    prefs: { onboarding_completed: true, school_name: "Liceo Scientifico A.Einstein" }
  },
  { 
    email: "demo.universita@inschool.com", password: "123456", role: "universitario", name: "Studente Universitario", age: 21,
    prefs: { onboarding_completed: true, school_name: "Medicina e Chirurgia" }
  },
  { 
    email: "demo.docente@inschool.com", password: "123456", role: "docente", name: "Prof. Rossi", age: 35,
    prefs: { onboarding_completed: true }
  },
];

async function seed() {
  console.log("🚀 AVVIO SEED ACCOUNT DEMO INSCHOOL...");
  console.log("🔗 URL:", supabaseUrl);
  
  for (const acc of accounts) {
    console.log(`\n-----------------------------------`);
    console.log(`📩 Registrazione: ${acc.email}`);
    try {
        // 1. SIGNUP
        const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email: acc.email, password: acc.password })
        });
        
        const data = await res.json();
        if (!res.ok) {
            console.log(`⚠️  Auth Warning (esiste già?):`, data.msg || data.message);
            continue; // Salta il resto, account già esistente
        }
        
        const userId = data.user?.id;
        const token = data.session?.access_token;
        
        if (!userId || !token) {
            console.log(`❌ Impossibile estrarre Auth Session. L'email confirmation è attiva su Supabase?`);
            continue;
        }

        console.log(`✅ Auth Ok! UserID: ${userId}`);

        // 2. CREAZIONE DEL child_profiles ATTRAVERSO IL JWT DELL'UTENTE (bypass RLS legit)
        const profilePayload = {
            name: acc.name,
            age: acc.age,
            school_level: acc.role,
            parent_id: userId,
            ...acc.prefs
        };

        const profileRes = await fetch(`${supabaseUrl}/rest/v1/child_profiles`, {
            method: "POST",
            headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${token}`, 
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify(profilePayload)
        });

        if (!profileRes.ok) {
            const profileData = await profileRes.json();
            console.log(`❌ Errore Creazione child_profile:`, profileData);
        } else {
            console.log(`✅ Profilo "${acc.name}" [${acc.role}] inizializzato perfettamente!`);
        }
    } catch (e) {
        console.error("Critial Error:", e);
    }
  }
  console.log("\n\n🎉 SEED FINITO COMPLETATO! Gli account sono pronti per i test.");
}

seed();
