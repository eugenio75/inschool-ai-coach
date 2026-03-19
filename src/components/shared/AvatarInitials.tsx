import { cn } from "@/lib/utils";

const BG_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

interface AvatarInitialsProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvatarInitials({ name, size = "md", className }: AvatarInitialsProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const colorClass = BG_COLORS[name.charCodeAt(0) % BG_COLORS.length];
  const sizeClass = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
  }[size];

  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold shrink-0", sizeClass, colorClass, className)}>
      {initials}
    </div>
  );
}
