-- KilimoSync — Row Level Security
-- Every table with user-owned or role-scoped data has RLS enabled and no
-- policy relies on frontend route hiding. See docs/SECURITY.md for the
-- authorization matrix this file implements, and docs/TESTING.md for the
-- negative-path tests that must pass against it.

-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions (security definer to avoid RLS recursion on self-joins)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

create or replace function public.owns_farmer_profile(p_farmer_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.farmer_profiles
    where id = p_farmer_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_farmer_of_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.farmer_profiles fp on fp.id = oi.farmer_id
    where oi.order_id = p_order_id and fp.user_id = auth.uid()
  );
$$;

-- Prevents a user (or a compromised client) from granting themselves admin
-- or editing another user's row via a crafted UPDATE payload.
create or replace function public.guard_user_self_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an admin may change a user role';
  end if;
  if new.is_suspended is distinct from old.is_suspended then
    raise exception 'Only an admin may change suspension status';
  end if;
  return new;
end;
$$;

create trigger guard_user_self_update
  before update on public.users
  for each row execute function public.guard_user_self_update();

-- Only an admin may set/clear farmer verification.
create or replace function public.guard_farmer_verification_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by then
    raise exception 'Only an admin may change farmer verification status';
  end if;
  return new;
end;
$$;

create trigger guard_farmer_verification_update
  before update on public.farmer_profiles
  for each row execute function public.guard_farmer_verification_update();

-- ─────────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.farmer_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────

create policy "users_select_own_or_admin" on public.users
  for select using (id = auth.uid() or public.is_admin());

create policy "users_update_own_or_admin" on public.users
  for update using (id = auth.uid() or public.is_admin());

-- No client-side insert/delete policy: rows are created by the
-- handle_new_user trigger and removed by cascading auth.users deletion.

-- ─────────────────────────────────────────────────────────────────────────
-- farmer_profiles — storefront data (farm name, county, verification badge)
-- is public marketplace information.
-- ─────────────────────────────────────────────────────────────────────────

create policy "farmer_profiles_select_all" on public.farmer_profiles
  for select using (true);

create policy "farmer_profiles_insert_own" on public.farmer_profiles
  for insert with check (user_id = auth.uid() and public.current_role() = 'farmer');

create policy "farmer_profiles_update_own_or_admin" on public.farmer_profiles
  for update using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- categories — public read, admin-managed
-- ─────────────────────────────────────────────────────────────────────────

create policy "categories_select_all" on public.categories
  for select using (true);

create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- products
-- ─────────────────────────────────────────────────────────────────────────

create policy "products_select_active_or_own_or_admin" on public.products
  for select using (
    status = 'active'
    or public.owns_farmer_profile(farmer_id)
    or public.is_admin()
  );

create policy "products_insert_own_farmer" on public.products
  for insert with check (public.owns_farmer_profile(farmer_id));

create policy "products_update_own_or_admin" on public.products
  for update using (public.owns_farmer_profile(farmer_id) or public.is_admin());

create policy "products_delete_own_or_admin" on public.products
  for delete using (public.owns_farmer_profile(farmer_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- carts / cart_items — buyer-owned only
-- ─────────────────────────────────────────────────────────────────────────

create policy "carts_owner_all" on public.carts
  for all using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

create policy "cart_items_owner_all" on public.cart_items
  for all using (
    exists (select 1 from public.carts c where c.id = cart_id and c.buyer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.carts c where c.id = cart_id and c.buyer_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- orders — buyer sees own, farmer sees orders containing their products,
-- admin sees all. Orders are created exclusively through server-side
-- checkout logic (service role), never a direct client insert.
-- ─────────────────────────────────────────────────────────────────────────

create policy "orders_select_buyer_farmer_admin" on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_farmer_of_order(id)
    or public.is_admin()
  );

create policy "orders_update_admin_only" on public.orders
  for update using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- order_items
-- ─────────────────────────────────────────────────────────────────────────

create policy "order_items_select_buyer_farmer_admin" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
    or public.owns_farmer_profile(farmer_id)
    or public.is_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────
-- payments — buyer and admin only. Never exposed to farmers.
-- Written exclusively by the service-role M-PESA integration.
-- ─────────────────────────────────────────────────────────────────────────

create policy "payments_select_buyer_or_admin" on public.payments
  for select using (buyer_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- deliveries
-- ─────────────────────────────────────────────────────────────────────────

create policy "deliveries_select_participants_or_admin" on public.deliveries
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
    or public.is_farmer_of_order(order_id)
    or transporter_id = auth.uid()
    or public.is_admin()
  );

create policy "deliveries_admin_write" on public.deliveries
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- notifications — strictly own
-- ─────────────────────────────────────────────────────────────────────────

create policy "notifications_owner_select" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_owner_update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- reviews — public read (storefront social proof), buyer writes for their
-- own completed order item, exactly once (unique constraint on order_item).
-- ─────────────────────────────────────────────────────────────────────────

create policy "reviews_select_all" on public.reviews
  for select using (true);

create policy "reviews_insert_own_completed_order" on public.reviews
  for insert with check (
    buyer_id = auth.uid()
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id
        and o.buyer_id = auth.uid()
        and o.order_status = 'COMPLETED'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- disputes
-- ─────────────────────────────────────────────────────────────────────────

create policy "disputes_select_participants_or_admin" on public.disputes
  for select using (
    user_id = auth.uid()
    or public.is_farmer_of_order(order_id)
    or public.is_admin()
  );

create policy "disputes_insert_own_order" on public.disputes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  );

create policy "disputes_update_admin_only" on public.disputes
  for update using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- audit_logs — admin read only; writes come from server-side service-role
-- code, never from client policies.
-- ─────────────────────────────────────────────────────────────────────────

create policy "audit_logs_admin_select" on public.audit_logs
  for select using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- platform_settings — readable by any authenticated user (needed to show
-- the platform fee at checkout), writable by admin only.
-- ─────────────────────────────────────────────────────────────────────────

create policy "platform_settings_select_authenticated" on public.platform_settings
  for select using (auth.role() = 'authenticated');

create policy "platform_settings_admin_update" on public.platform_settings
  for update using (public.is_admin());
