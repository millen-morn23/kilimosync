export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, matches the storage bucket's file_size_limit

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Only JPEG, PNG or WebP images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be smaller than 5MB.";
  }
  return null;
}

export function safeImageFileName(file: File, userId: string): string {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const random = crypto.randomUUID();
  // Path is prefixed with the uploader's own id — required by the storage
  // RLS policies in supabase/migrations/0004_storage.sql.
  return `${userId}/${random}.${ext}`;
}
