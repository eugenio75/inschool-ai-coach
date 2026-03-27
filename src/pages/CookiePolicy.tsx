import { Link } from "react-router-dom";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna alla home</Link>

        <h1 className="text-3xl font-display font-bold mt-8 mb-2">InSchool — Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Ultimo aggiornamento: marzo 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">Cosa sono i cookie</h2>
            <p>I cookie sono piccoli file di testo salvati sul dispositivo dell'utente durante la navigazione.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Cookie che usiamo</h2>
            <h3 className="text-base font-medium mt-4">Cookie tecnici (necessari)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg mt-2">
                <thead><tr className="bg-muted"><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Finalità</th><th className="px-3 py-2 text-left">Durata</th></tr></thead>
                <tbody>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">session_token</td><td className="px-3 py-2">Autenticazione utente</td><td className="px-3 py-2">Sessione</td></tr>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">preferences</td><td className="px-3 py-2">Impostazioni lingua e tema</td><td className="px-3 py-2">1 anno</td></tr>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">cookie_consent</td><td className="px-3 py-2">Salvataggio scelta cookie</td><td className="px-3 py-2">1 anno</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-medium mt-6">Cookie analitici (opzionali, richiedono consenso)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg mt-2">
                <thead><tr className="bg-muted"><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Finalità</th><th className="px-3 py-2 text-left">Durata</th></tr></thead>
                <tbody>
                  <tr className="border-t border-border"><td className="px-3 py-2 font-mono text-xs">analytics_id</td><td className="px-3 py-2">Miglioramento del servizio in forma anonima</td><td className="px-3 py-2">6 mesi</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Cookie di terze parti</h2>
            <p>InSchool non usa cookie pubblicitari né condivide dati con inserzionisti.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Gestione</h2>
            <p>Puoi gestire o disabilitare i cookie nelle impostazioni del browser o tramite il banner presente nell'app. La disabilitazione dei cookie tecnici potrebbe compromettere il funzionamento del servizio.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Consenso</h2>
            <p>Al primo accesso viene mostrato un banner per il consenso ai cookie analitici opzionali. I cookie tecnici non richiedono consenso in quanto necessari al funzionamento.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Contatti</h2>
            <p>Per informazioni: <a href="mailto:inschool.privacy@azarlabs.com" className="text-primary">inschool.privacy@azarlabs.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
