"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createProduct, updateProduct } from "@/lib/actions/product";
import { createProductSchema, PRICE_UNITS, type CreateProductInput } from "@/lib/validation/product";
import { ProductImageUploader } from "@/components/farmer/product-image-uploader";
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

type Category = { id: string; name: string };

export function ProductForm({
  categories,
  productId,
  defaultValues,
}: {
  categories: Category[];
  productId?: string;
  defaultValues?: Partial<CreateProductInput>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      priceUnit: "kg",
      quantityUnit: "kg",
      images: [],
      ...defaultValues,
    },
  });

  const images = watch("images");

  async function onSubmit(values: CreateProductInput) {
    setSubmitting(true);
    const result = productId
      ? await updateProduct(productId, values)
      : await createProduct(values);
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(productId ? "Listing updated" : "Listing created");
    router.push("/dashboard/farmer/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" placeholder="e.g. Tomatoes" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="categoryId">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} placeholder="Describe your produce" {...register("description")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Price (KES)</Label>
          <Input id="price" type="number" step="0.01" min="0" {...register("price", { valueAsNumber: true })} />
          {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceUnit">Per</Label>
          <Controller
            control={control}
            name="priceUnit"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="priceUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="quantityAvailable">Quantity available</Label>
          <Input id="quantityAvailable" type="number" step="0.01" min="0" {...register("quantityAvailable", { valueAsNumber: true })} />
          {errors.quantityAvailable && (
            <p className="text-sm text-destructive">{errors.quantityAvailable.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantityUnit">Unit</Label>
          <Controller
            control={control}
            name="quantityUnit"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="quantityUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minOrderQuantity">Minimum order</Label>
          <Input id="minOrderQuantity" type="number" step="0.01" min="0" {...register("minOrderQuantity", { valueAsNumber: true })} />
          {errors.minOrderQuantity && (
            <p className="text-sm text-destructive">{errors.minOrderQuantity.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="harvestDate">Harvest date (optional)</Label>
        <Input id="harvestDate" type="date" {...register("harvestDate")} />
      </div>

      <div className="space-y-2">
        <Label>Photos</Label>
        <ProductImageUploader images={images ?? []} onChange={(imgs) => setValue("images", imgs)} />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : productId ? "Save changes" : "Create listing"}
      </Button>
    </form>
  );
}
