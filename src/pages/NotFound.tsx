import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLang();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-10 h-10" />
        </div>
        <h1 className="text-6xl font-display font-bold text-foreground mb-3">404</h1>
        <p className="text-lg text-muted-foreground mb-2">{t("not_found_title")}</p>
        <p className="text-sm text-muted-foreground/70 mb-8">{t("not_found_body")}</p>
        <Button asChild size="lg" className="rounded-xl font-bold">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            {t("not_found_cta")}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
