import { ClipboardList, Search, Smartphone, Truck } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Farmers list produce",
    description: "Farmers create a listing with price, quantity and photos in minutes.",
  },
  {
    icon: Search,
    title: "Buyers discover it",
    description: "Buyers search and filter by location, price and category.",
  },
  {
    icon: Smartphone,
    title: "Buyers pay with M-PESA",
    description: "Checkout is secured with an M-PESA STK push — no cash handling.",
  },
  {
    icon: Truck,
    title: "Produce is delivered",
    description: "Orders are prepared, coordinated for delivery, and confirmed.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            A simple, trustworthy path from farm to table.
          </p>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="relative rounded-xl border border-border p-6">
              <span className="text-xs font-semibold text-muted-foreground">
                STEP {index + 1}
              </span>
              <step.icon className="mt-4 size-8 text-primary" />
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
