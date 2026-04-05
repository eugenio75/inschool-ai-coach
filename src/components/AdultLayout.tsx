import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";

export function AdultLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden sm:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="ml-1 hidden sm:inline-flex" />
              <span className="font-display text-sm font-bold tracking-tight text-foreground sm:hidden">SarAI</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LangToggle />
              <ThemeToggle />
              <div className="hidden sm:block">
                <LogoutButton showLabel />
              </div>
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