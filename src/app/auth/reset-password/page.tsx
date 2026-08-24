import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Set New Password" };

export default async function ResetPasswordPage() {
  // /auth/callback exchanges the emailed recovery code for a session before
  // redirecting here — if there's no session, the link was invalid, already
  // used, or the page was opened directly rather than via a real email link.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-svh flex-col bg-accent/30">
      <header className="px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" aria-label="KilimoSync home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Set a new password</CardTitle>
              <CardDescription>Choose a new password for your account</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              {user ? (
                <UpdatePasswordForm />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This password reset link is invalid or has expired.{" "}
                  <Link href="/forgot-password" className="font-medium text-primary underline">
                    Request a new one
                  </Link>
                  .
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
