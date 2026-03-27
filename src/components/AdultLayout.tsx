import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { getChildSession } from "@/lib/childSession";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { useLang } from "@/contexts/LangContext";

export function AdultLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const session = getChildSession();
  const profile = session?.profile;
  const role = profile?.school_level || "";
  const roleLabel = role === "superiori" ? t("role_student") : role === "universitario" ? t("role_university") : role === "docente" ? t("role_teacher") : "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden sm:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 hidden sm:flex items-center justify-between border-b border-border px-5 bg-card">
            <SidebarTrigger className="ml-1" />
            <div className="flex items-center gap-3">
              <LangToggle />
              <ThemeToggle />
              <LogoutButton showLabel />
            </div>
          </header>
          <main className="flex-1 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}