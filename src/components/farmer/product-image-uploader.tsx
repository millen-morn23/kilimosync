"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { safeImageFileName, validateImageFile } from "@/lib/validation/upload";

const MAX_IMAGES = 6;

export function ProductImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to upload images.");
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];

    for (const file of Array.from(files).slice(0, remaining)) {
      const validationError = validateImageFile(file);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        continue;
      }

      const path = safeImageFileName(file, user.id);
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        toast.error(`Could not upload ${file.name}.`);
        continue;
      }

      const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
      uploaded.push(publicUrl.publicUrl);
    }

    setUploading(false);
    if (uploaded.length > 0) {
      onChange([...images, ...uploaded]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeImage(url: string) {
    onChange(images.filter((img) => img !== url));
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((url) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
            <Image src={url} alt="Product" fill className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute top-1 right-1 rounded-full bg-background/90 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-xs">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="mt-2 text-xs text-muted-foreground">
        JPEG, PNG or WebP, up to 5MB each. {images.length}/{MAX_IMAGES} added.
      </p>
    </div>
  );
}
