import { BadgeCheck, HandCoins, MapPinned, ShieldCheck } from "lucide-react";

const REASONS = [
  {
    icon: HandCoins,
    title: "Fair pricing",
    description: "Farmers set their own prices — no broker markup.",
  },
  {
    icon: BadgeCheck,
    title: "Verified farmers",
    description: "Every verification badge means an admin reviewed that farm.",
  },
  {
    icon: ShieldCheck,
    title: "Secure payments",
    description: "M-PESA checkout, confirmed only by Safaricom — never assumed.",
  },
  {
    icon: MapPinned,
    title: "Built for Kenya",
    description: "County-based discovery, Kenyan phone numbers, KES pricing.",
  },
];

export function WhyKilimoSync() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Why KilimoSync
          </h2>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((reason) => (
            <div key={reason.title} className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent">
                <reason.icon className="size-6 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {reason.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
