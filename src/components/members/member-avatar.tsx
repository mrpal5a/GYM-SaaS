import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function MemberAvatar({
  name,
  photoUrl,
  size = "default",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
      <AvatarFallback>{initials(name) || "?"}</AvatarFallback>
    </Avatar>
  );
}
