"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createOrder } from "@/lib/actions/checkout";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { KENYAN_COUNTIES } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CheckoutForm({ defaultValues }: { defaultValues: Partial<CheckoutInput> }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues,
  });

  async function onSubmit(values: CheckoutInput) {
    setSubmitting(true);
    const result = await createOrder(values);
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.push(`/orders/${result.orderId}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="buyerName">Full name</Label>
        <Input id="buyerName" {...register("buyerName")} />
        {errors.buyerName && (
          <p className="text-sm text-destructive">{errors.buyerName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="buyerPhone">Phone number</Label>
        <Input id="buyerPhone" placeholder="0712345678" {...register("buyerPhone")} />
        {errors.buyerPhone && (
          <p className="text-sm text-destructive">{errors.buyerPhone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliveryCounty">Delivery county</Label>
        <Controller
          control={control}
          name="deliveryCounty"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="deliveryCounty">
                <SelectValue placeholder="Select county" />
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
        {errors.deliveryCounty && (
          <p className="text-sm text-destructive">{errors.deliveryCounty.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliveryAddress">Delivery address</Label>
        <Input
          id="deliveryAddress"
          placeholder="Street, estate or landmark"
          {...register("deliveryAddress")}
        />
        {errors.deliveryAddress && (
          <p className="text-sm text-destructive">{errors.deliveryAddress.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliveryNotes">Delivery instructions (optional)</Label>
        <Textarea id="deliveryNotes" rows={3} {...register("deliveryNotes")} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Placing order…" : "Place order"}
      </Button>
    </form>
  );
}
