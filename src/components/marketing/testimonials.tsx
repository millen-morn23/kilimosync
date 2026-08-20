import { Quote } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Placeholder quotes for pre-launch design review only — these are not
// real customers. Replace with genuine testimonials once the pilot cohort
// (see docs/ROADMAP.md) has completed real transactions. Do not ship this
// section to production without either real testimonials or removing it.
const PLACEHOLDER_TESTIMONIALS = [
  {
    quote: "I could finally sell my tomatoes without a broker taking half the price.",
    name: "Pilot farmer persona",
    role: "Farmer, Kiambu County",
  },
  {
    quote: "Ordering fresh vegetables and paying with M-PESA took less than two minutes.",
    name: "Pilot buyer persona",
    role: "Buyer, Nairobi",
  },
  {
    quote: "Knowing the farmer was verified made me trust the first order.",
    name: "Pilot buyer persona",
    role: "Buyer, Mombasa",
  },
];

export function Testimonials() {
  return (
    <section className="border-y border-border bg-accent/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mx-auto">
            Design preview — placeholder content
          </Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            What the pilot cohort will tell us
          </h2>
          <p className="mt-3 text-muted-foreground">
            These are illustrative placeholders, not real customer quotes.
            They&apos;ll be replaced once our pilot farmers and buyers have
            completed real transactions.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLACEHOLDER_TESTIMONIALS.map((t) => (
            <Card key={t.name} className="gap-4 p-6">
              <Quote className="size-6 text-primary/60" />
              <p className="text-sm text-foreground">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
