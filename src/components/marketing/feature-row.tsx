import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export function FeatureRow({
  id,
  eyebrow,
  title,
  description,
  bullets,
  visual,
  reverse = false,
  tone = "default",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: ReactNode;
  reverse?: boolean;
  tone?: "default" | "accent";
}) {
  return (
    <section
      id={id}
      className={cn("py-20", tone === "accent" && "bg-accent/30 border-y border-border")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid items-center gap-12 lg:grid-cols-2",
            reverse && "lg:[&>*:first-child]:order-2"
          )}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-4 text-muted-foreground">{description}</p>
            <ul className="mt-6 space-y-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
          <div>{visual}</div>
        </div>
      </div>
    </section>
  );
}

export function FeatureVisualPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex aspect-[4/3] flex-col justify-center rounded-2xl border border-border bg-gradient-to-br from-background to-accent/50 p-8">
      {children}
    </div>
  );
}
