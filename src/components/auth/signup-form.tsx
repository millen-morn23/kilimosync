"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { signUp } from "@/lib/actions/auth";
import { KENYAN_COUNTIES, signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") === "farmer" ? "farmer" : "buyer";
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { role: defaultRole },
  });

  const role = useWatch({ control, name: "role" });

  async function onSubmit(values: SignUpInput) {
    setSubmitting(true);
    const result = await signUp(values);
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve sent a confirmation link to your inbox. Confirm your
          email to activate your KilimoSync account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setValue("role", "buyer")}
          className={cn(
            "rounded-lg border border-input px-4 py-3 text-sm font-medium transition-colors",
            role === "buyer"
              ? "border-primary bg-primary/5 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          I&apos;m a buyer
        </button>
        <button
          type="button"
          onClick={() => setValue("role", "farmer")}
          className={cn(
            "rounded-lg border border-input px-4 py-3 text-sm font-medium transition-colors",
            role === "farmer"
              ? "border-primary bg-primary/5 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          I&apos;m a farmer
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" type="tel" placeholder="0712345678" {...register("phone")} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="county">County</Label>
        <Controller
          control={control}
          name="county"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="county">
                <SelectValue placeholder="Select your county" />
              </SelectTrigger>
              <SelectContent>
                {KENYAN_COUNTIES.map((county) => (
                  <SelectItem key={county} value={county}>
                    {county}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.county && <p className="text-sm text-destructive">{errors.county.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
