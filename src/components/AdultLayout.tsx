import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AdultLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden sm:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 hidden sm:flex items-center justify-between border-b border-border px-4 bg-card">
            <SidebarTrigger className="ml-1" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton showLabel />
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
