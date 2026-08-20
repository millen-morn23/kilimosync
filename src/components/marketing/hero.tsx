import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
        <div>
          <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
            Now onboarding pilot farmers in Kenya
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            From Kenyan Farms to Your Table.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            KilimoSync connects farmers directly with buyers, making fresh
            produce easier to sell, discover and purchase.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/marketplace">
                Explore Fresh Produce
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/signup?role=farmer">Sell on KilimoSync</Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/3] w-full rounded-2xl border border-border bg-gradient-to-br from-accent to-background p-8 shadow-sm">
            <div className="grid h-full grid-cols-2 gap-4">
              <div className="rounded-xl bg-primary/10 p-5">
                <p className="text-sm font-medium text-primary">For Farmers</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  List produce
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  in minutes, no middlemen
                </p>
              </div>
              <div className="mt-8 rounded-xl bg-secondary/10 p-5">
                <p className="text-sm font-medium text-secondary-foreground">
                  For Buyers
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  Pay with M-PESA
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  fresh produce, fair prices
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
