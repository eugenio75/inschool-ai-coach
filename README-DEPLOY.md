# InSchool — Note di deploy

## Supabase
Il progetto usa un account Supabase proprio (non Lovable).
Prima del deploy su server:
1. Crea progetto su supabase.com
2. Copia URL e anon key nel .env reale
3. Esegui le migration: `supabase db push`
4. Configura i secrets edge functions in Supabase Dashboard → Settings → Edge Functions:
   - CHAIN_API_URL=https://api-chain.azarlabs.com
   - CHAIN_API_KEY=(stesso valore del .env Azar Chain)
   - HMAC_SECRET=(genera con crypto.randomBytes(32).toString('hex'))

## Server (Virtualmin + Nginx)
- Node.js >= 18
- Build: `npm run build`
- Servi la cartella `dist/` con Nginx
- Configura HTTPS con Let's Encrypt (Virtualmin lo gestisce)

## Azar Chain backend
- Già attivo: api-chain.azarlabs.com
- Container Docker: azar-api-chain
- Rebuild se necessario: `cd /opt/azar-chain && docker compose up -d --build api-chain`

## Variabili .env produzione
Copia .env.example → .env e compila tutti i valori.
Non committare mai il .env reale su GitHub.
Aggiungilo a .gitignore se non già presente.
