import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LangContext";

export function LandingNavbar() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { label: t("home_nav_come"), href: "#come-funziona" },
    { label: t("home_nav_studenti"), href: "/studenti" },
    { label: t("home_nav_docenti"), href: "/docenti" },
    { label: t("home_nav_sicurezza"), href: "/security" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-5">
        {/* Logo */}
        <Link to="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-bold" style={{ color: "#1A3A5C" }}>
            SarAI
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — {t("home_tagline")}
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          <LangToggle />
          <Button asChild size="sm" style={{ backgroundColor: "#0070C0" }} className="hover:opacity-90">
            <Link to="/auth">{t("home_nav_cta")}</Link>
          </Button>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <LangToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-12">
              <div className="flex flex-col gap-4">
                {navLinks.map((link) =>
                  link.href.startsWith("#") ? (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="text-base font-medium text-foreground py-2"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setOpen(false)}
                      className="text-base font-medium text-foreground py-2"
                    >
                      {link.label}
                    </Link>
                  )
                )}
                <div className="pt-4 border-t border-border">
                  <Button asChild className="w-full" style={{ backgroundColor: "#0070C0" }}>
                    <Link to="/auth" onClick={() => setOpen(false)}>
                      {t("home_nav_cta")}
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
