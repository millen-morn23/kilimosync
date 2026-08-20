"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { requestPasswordReset } from "@/lib/actions/auth";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = { email: string };

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(requestPasswordResetSchema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    await requestPasswordReset(values);
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for that address, we&apos;ve sent a link to
          reset your password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
