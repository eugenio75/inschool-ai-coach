import { Link } from "react-router-dom";

export default function TerminiDiServizio() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna alla home</Link>

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">InSchool — Termini di Servizio</h1>
        <p className="text-sm text-muted-foreground mb-10">Ultimo aggiornamento: marzo 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">1. Servizio</h2>
            <p>InSchool è una piattaforma di coaching educativo AI sviluppata da Tenks S.r.l.s. tramite AzarLabs Division. L'accesso al servizio è soggetto all'accettazione dei presenti termini.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Registrazione</h2>
            <p>Per accedere è necessario creare un account fornendo dati veritieri. Gli utenti minorenni devono ottenere il consenso di un genitore o tutore legale.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Uso corretto</h2>
            <p>L'utente si impegna a usare InSchool per finalità educative personali. È vietato: condividere l'account, usare il servizio per attività illegali, tentare di accedere ai sistemi in modo non autorizzato.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Contenuti generati dall'AI</h2>
            <p>I contenuti prodotti dal coach AI hanno finalità educativa e di supporto. Non sostituiscono il giudizio professionale di insegnanti, psicologi o medici. In caso di difficoltà emotive significative InSchool orienta verso supporto professionale.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Proprietà intellettuale</h2>
            <p>I materiali creati dal docente tramite InSchool rimangono di proprietà del docente. I contenuti generati dall'AI appartengono a Tenks S.r.l.s.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Sospensione del servizio</h2>
            <p>Tenks S.r.l.s. si riserva il diritto di sospendere l'account in caso di violazione dei presenti termini.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Limitazione di responsabilità</h2>
            <p>InSchool non garantisce risultati scolastici specifici. Il servizio è fornito "così com'è" nel rispetto delle normative vigenti.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Legge applicabile</h2>
            <p>I presenti termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente il Foro di Catanzaro.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Contatti</h2>
            <p>Tenks S.r.l.s. — <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
