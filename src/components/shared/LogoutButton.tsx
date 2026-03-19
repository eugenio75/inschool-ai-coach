import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export function LogoutButton({ showLabel = false }: { showLabel?: boolean }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    localStorage.removeItem("inschool-child-session");
    localStorage.removeItem("inschool-active-child-id");
    localStorage.removeItem("inschool-profile");
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="flex items-center gap-2 p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
          <LogOut className="w-4 h-4" />
          {showLabel && <span className="text-sm font-medium hidden sm:inline">Esci</span>}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Sei sicuro di voler uscire?</AlertDialogTitle>
          <AlertDialogDescription>
            Verrai disconnesso dal tuo account InSchool.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Esci
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
