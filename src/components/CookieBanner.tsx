import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const accept = (value: "all" | "necessary") => {
    localStorage.setItem("cookie_consent", value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-card border-t border-border shadow-lg px-4 py-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          SarAI usa cookie tecnici necessari al funzionamento e cookie analitici opzionali per migliorare il servizio.{" "}
          <Link to="/cookie-policy" className="underline text-primary hover:text-primary/80">Cookie Policy</Link>
          {" · "}
          <Link to="/privacy-policy" className="underline text-primary hover:text-primary/80">Privacy Policy</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accept("necessary")}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            Solo necessari
          </button>
          <button
            onClick={() => accept("all")}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Accetta tutti
          </button>
        </div>
      </div>
    </div>
  );
}
