-- KilimoSync — storage buckets for user-uploaded images.
-- File type/size are validated client- and server-side before upload (see
-- src/lib/validation/upload.ts) — these policies additionally constrain
-- *where* a user may write, which client-side checks alone cannot enforce.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('farmer-images', 'farmer-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-images', 'profile-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public read on all three buckets — product/farm/profile photos are
-- storefront-public by design.
create policy "public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "public_read_farmer_images" on storage.objects
  for select using (bucket_id = 'farmer-images');

create policy "public_read_profile_images" on storage.objects
  for select using (bucket_id = 'profile-images');

-- Uploads must live under a path prefixed with the uploader's own
-- auth.uid(), e.g. `product-images/<user_id>/<file>`. The application
-- enforces this prefix when building the upload path.
create policy "own_write_product_images" on storage.objects
  for insert with check (
    bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_update_product_images" on storage.objects
  for update using (
    bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_delete_product_images" on storage.objects
  for delete using (
    bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_write_farmer_images" on storage.objects
  for insert with check (
    bucket_id = 'farmer-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_update_farmer_images" on storage.objects
  for update using (
    bucket_id = 'farmer-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_write_profile_images" on storage.objects
  for insert with check (
    bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_update_profile_images" on storage.objects
  for update using (
    bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
