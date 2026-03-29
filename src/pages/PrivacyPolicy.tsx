import { Link } from "react-router-dom";
import { FloatingBackButton } from "@/components/shared/FloatingBackButton";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <FloatingBackButton />
      <div className="max-w-3xl mx-auto px-6 py-24">

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">InSchool — Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Ultimo aggiornamento: marzo 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">Titolare del trattamento</h2>
            <p>Tenks S.r.l.s. — AzarLabs Division<br />Sede legale: Calabria, Italia<br />Email: inschool.privacy@azarlabs.com</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Quali dati raccogliamo</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dati di registrazione:</strong> nome, cognome, email, ruolo (studente/docente/genitore).</li>
              <li><strong>Dati d'uso:</strong> sessioni di studio, materiali creati, progressi, verifiche.</li>
              <li><strong>Dati emotivi aggregati:</strong> check-in giornaliero, segnali di benessere — trattati in forma anonimizzata.</li>
              <li><strong>Dati tecnici:</strong> indirizzo IP, browser, dispositivo — raccolti automaticamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Perché li raccogliamo</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Erogare il servizio di coaching educativo AI.</li>
              <li>Personalizzare l'esperienza in base al profilo.</li>
              <li>Migliorare la piattaforma.</li>
              <li>Adempiere agli obblighi di legge.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Base giuridica</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Esecuzione del contratto (art. 6.1.b GDPR)</strong> — per erogare il servizio.</li>
              <li><strong>Consenso (art. 6.1.a GDPR)</strong> — per i dati emotivi e per i minori.</li>
              <li><strong>Legittimo interesse (art. 6.1.f GDPR)</strong> — per migliorare la piattaforma.</li>
              <li><strong>Obbligo legale (art. 6.1.c GDPR)</strong> — per adempimenti normativi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Minori</h2>
            <p>Per gli utenti sotto i 14 anni è richiesto il consenso esplicito del genitore o tutore legale. I dati dei minori non vengono mai condivisi con terzi né usati per finalità di marketing.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Blockchain</h2>
            <p>InSchool usa Azar Chain, blockchain privata proprietaria, per certificare competenze e garantire conformità EU AI Act. Sulla blockchain vengono registrati esclusivamente hash anonimi — mai dati personali identificativi.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Conservazione dei dati</h2>
            <p>I dati vengono conservati per tutta la durata del rapporto contrattuale e per i 12 mesi successivi alla cancellazione dell'account, salvo obblighi di legge.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">I tuoi diritti</h2>
            <p>Ai sensi del GDPR hai diritto a: accesso, rettifica, cancellazione (diritto all'oblio), portabilità, opposizione al trattamento.<br />Per esercitarli: <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Trasferimenti extra-UE</h2>
            <p>I dati vengono trattati all'interno dello Spazio Economico Europeo. In caso di trasferimenti extra-UE verranno adottate garanzie adeguate ai sensi degli artt. 46-49 GDPR.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Cookie</h2>
            <p>InSchool usa cookie tecnici necessari al funzionamento del servizio e cookie analitici opzionali. Per dettagli vedere la <Link to="/cookie-policy" className="text-primary">Cookie Policy</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Modifiche</h2>
            <p>Ci riserviamo il diritto di aggiornare questa policy. In caso di modifiche sostanziali l'utente verrà notificato via email.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
