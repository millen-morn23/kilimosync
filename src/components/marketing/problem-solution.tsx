import { AlertTriangle, CheckCircle2 } from "lucide-react";

const PROBLEMS = [
  "Dependence on brokers who capture most of the margin",
  "Low farm-gate prices for farmers",
  "Limited access to urban buyers and markets",
  "Produce wastage from unpredictable demand",
];

const SOLUTIONS = [
  "Direct connection between farmers and buyers",
  "Transparent pricing set by the farmer",
  "A digital storefront visible to buyers across counties",
  "Real demand signals so farmers can plan harvests",
];

export function ProblemSolution() {
  return (
    <section className="border-t border-border bg-accent/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <AlertTriangle className="size-6 text-warning" />
              The problem
            </h2>
            <p className="mt-3 text-muted-foreground">
              Small-scale farmers struggle to reach reliable markets, while
              urban buyers struggle to find consistent, fairly-priced fresh
              produce.
            </p>
            <ul className="mt-6 space-y-3">
              {PROBLEMS.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <CheckCircle2 className="size-6 text-primary" />
              The KilimoSync solution
            </h2>
            <p className="mt-3 text-muted-foreground">
              A trusted digital marketplace that makes it easier for Kenyan
              farmers to sell produce and easier for buyers to discover and
              receive it.
            </p>
            <ul className="mt-6 space-y-3">
              {SOLUTIONS.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
