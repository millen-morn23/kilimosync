import Link from "next/link";
import { Compass } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-accent/30 px-4 text-center">
      <Logo />
      <Compass className="size-10 text-primary" />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/marketplace">Browse marketplace</Link>
        </Button>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
