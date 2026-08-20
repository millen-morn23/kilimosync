import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-8" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Kilimo<span className="text-primary">Sync</span>
      </span>
    </span>
  );
}
