import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) {
      document.documentElement.style.removeProperty("--cookie-banner-height");
      return;
    }

    const updateHeight = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--cookie-banner-height", `${height}px`);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && bannerRef.current) {
      observer = new ResizeObserver(updateHeight);
      observer.observe(bannerRef.current);
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      document.documentElement.style.removeProperty("--cookie-banner-height");
    };
  }, [visible]);

  const accept = (value: "all" | "necessary") => {
    localStorage.setItem("cookie_consent", value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div ref={bannerRef} className="fixed bottom-0 left-0 right-0 z-[100] bg-card border-t border-border shadow-lg px-4 py-4 sm:px-6">
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
