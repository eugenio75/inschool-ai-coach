import { Link } from "react-router-dom";

export default function EuAiAct() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna alla home</Link>

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">InSchool — Conformità EU AI Act</h1>
        <p className="text-sm text-muted-foreground mb-10">Ultimo aggiornamento: marzo 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">Impegno di conformità</h2>
            <p>InSchool è sviluppato in linea con i principi e i requisiti chiave del Regolamento Europeo sull'Intelligenza Artificiale (EU AI Act), con scadenza di conformità agosto 2026.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Classificazione del sistema</h2>
            <p>InSchool è classificato come sistema AI ad uso educativo. In quanto tale adotta misure specifiche di trasparenza, supervisione umana e protezione degli utenti vulnerabili.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Misure adottate</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Trasparenza:</strong> gli utenti sono sempre informati che stanno interagendo con un sistema AI. Il coach non si presenta mai come umano.</li>
              <li><strong>Supervisione umana:</strong> il coach AI supporta — non sostituisce — il giudizio di insegnanti e famiglie.</li>
              <li><strong>Protezione dei minori:</strong> protocolli specifici per fascia d'età, consenso genitoriale obbligatorio per i minori di 14 anni.</li>
              <li><strong>Tracciabilità:</strong> ogni sessione AI viene registrata con log immutabile su Azar Chain per garantire audit trail completo.</li>
              <li><strong>Non discriminazione:</strong> il sistema è progettato per non amplificare bias legati a genere, etnia, disabilità o background socioeconomico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Blockchain e audit trail</h2>
            <p>InSchool usa Azar Chain (Chain ID 24780) — blockchain privata proprietaria — per registrare in modo immutabile e verificabile i log delle sessioni AI. Questo garantisce la conformità agli obblighi di tracciabilità del EU AI Act.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Contatti</h2>
            <p>Per informazioni sulla conformità: <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
