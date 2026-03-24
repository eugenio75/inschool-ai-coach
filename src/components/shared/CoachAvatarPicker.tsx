import { cn } from "@/lib/utils";
import gufoImg from "@/assets/coach-avatars/gufo.png";
import robotImg from "@/assets/coach-avatars/robot.png";
import volpeImg from "@/assets/coach-avatars/volpe.png";
import astroImg from "@/assets/coach-avatars/astro.png";
import delfinoImg from "@/assets/coach-avatars/delfino.png";
import brainImg from "@/assets/coach-avatars/brain.png";

export const COACH_AVATARS = [
  { id: "gufo", label: "Gufo", src: gufoImg },
  { id: "robot", label: "Robot", src: robotImg },
  { id: "volpe", label: "Volpe", src: volpeImg },
  { id: "astro", label: "Astro", src: astroImg },
  { id: "delfino", label: "Delfino", src: delfinoImg },
  { id: "brain", label: "Brain", src: brainImg },
] as const;

export type CoachAvatarId = (typeof COACH_AVATARS)[number]["id"];

export function getCoachAvatarSrc(id?: string | null): string {
  const found = COACH_AVATARS.find((a) => a.id === id);
  return found?.src || brainImg;
}

interface CoachAvatarPickerProps {
  selected: string | null;
  onSelect: (id: string) => void;
  size?: "sm" | "md";
}

export function CoachAvatarPicker({ selected, onSelect, size = "md" }: CoachAvatarPickerProps) {
  const imgSize = size === "sm" ? "w-14 h-14" : "w-18 h-18";
  const ringSize = size === "sm" ? "w-[68px] h-[68px]" : "w-[84px] h-[84px]";

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {COACH_AVATARS.map((avatar) => {
        const isSel = selected === avatar.id;
        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelect(avatar.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-all",
              isSel
                ? "bg-primary/10 ring-2 ring-primary scale-105"
                : "hover:bg-muted/50"
            )}
          >
            <div className={cn("rounded-full overflow-hidden bg-muted/30", ringSize)}>
              <img
                src={avatar.src}
                alt={avatar.label}
                loading="lazy"
                className={cn("object-cover", imgSize)}
                width={size === "sm" ? 56 : 72}
                height={size === "sm" ? 56 : 72}
              />
            </div>
            <span className={cn(
              "text-xs font-medium",
              isSel ? "text-primary" : "text-muted-foreground"
            )}>
              {avatar.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
