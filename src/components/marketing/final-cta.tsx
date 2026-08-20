import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl rounded-2xl bg-primary px-8 py-16 text-center sm:px-16">
        <h2 className="text-3xl font-semibold tracking-tight text-primary-foreground">
          Ready to join KilimoSync?
        </h2>
        <p className="mt-4 text-primary-foreground/80">
          Whether you&apos;re growing produce or buying it, KilimoSync makes
          the connection simple and trustworthy.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" variant="secondary" asChild>
            <Link href="/marketplace">
              Explore Fresh Produce
              <ArrowRight />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            asChild
          >
            <Link href="/signup?role=farmer">Sell on KilimoSync</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
