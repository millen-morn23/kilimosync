import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignUpForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Join KilimoSync as a buyer or farmer</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <Suspense>
          <SignUpForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
