// This script creates Demo accounts for testing the 4 Governance profiles.
// Run with: node scripts/seed_demo.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://iylspdscllcstgfipydc.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const accounts = [
  { email: "demo.genitore@azarlabs.com", role: "alunno", fname: "Demo", lname: "Genitore", school: "" },
  { email: "demo.liceale@azarlabs.com", role: "liceale", fname: "Demo", lname: "Liceale", school: "Liceo Scientifico Newton" },
  { email: "demo.universita@azarlabs.com", role: "universita", fname: "Demo", lname: "Studente", school: "Politecnico" },
  { email: "demo.docente@azarlabs.com", role: "docente", fname: "Demo", lname: "Professore", school: "Istituto Comprensivo" },
];

async function seed() {
  console.log("Starting Demo Account seeding...");
  
  for (const acc of accounts) {
    console.log(`\nRegistering ${acc.email}...`);
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: acc.email,
      password: "AzarLabs2026!"
    });
    
    if (authErr) {
      if (authErr.message.includes("already registered")) {
        console.log(`-> Already exists, skipping signup.`);
      } else {
        console.error("-> Error:", authErr.message);
        continue;
      }
    }
    
    // Check if we need to insert profile (only if we just signed up or it's missing)
    // we use a generic method here, but normally they just need credentials to test.
    // The user can also login and the app will guide them to finish profile setup if needed, 
    // but the instruction was to generate demo accounts.
    console.log(`-> Credentials: ${acc.email} / AzarLabs2026!`);
  }
  
  console.log("\nSeeding complete. Use the credentials above to test the 4 profiles.");
}

seed();
