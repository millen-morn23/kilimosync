-- KilimoSync — initial schema
-- See docs/DATABASE.md for the full data model rationale.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────

create type public.user_role as enum ('buyer', 'farmer', 'admin');

create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');

create type public.product_status as enum ('active', 'paused', 'sold_out', 'deleted');

-- Payment lifecycle. Shared between orders.payment_status and payments.status
-- so both entities always speak the same vocabulary.
create type public.payment_status as enum (
  'PENDING',
  'STK_SENT',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'TIMEOUT'
);

-- Fulfillment lifecycle, distinct from payment_status (an order cannot be
-- CONFIRMED until its payment_status is PAID).
create type public.order_status as enum (
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'DISPUTED'
);

create type public.delivery_status as enum (
  'UNASSIGNED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED'
);

create type public.dispute_status as enum ('open', 'investigating', 'resolved', 'rejected');

create type public.notification_type as enum (
  'order_placed',
  'payment_successful',
  'payment_failed',
  'order_confirmed',
  'order_preparing',
  'order_ready',
  'order_out_for_delivery',
  'order_delivered',
  'new_order',
  'low_stock',
  'order_update',
  'farmer_verified',
  'farmer_rejected',
  'new_farmer_signup',
  'dispute_opened',
  'dispute_resolved',
  'system_warning'
);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at helper
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- users (1:1 extension of auth.users)
-- ─────────────────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  role public.user_role not null default 'buyer',
  county text,
  location text,
  profile_image text,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_role_idx on public.users(role);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Creates the public profile row when a new auth user signs up.
-- Public self-signup may only ever produce buyer/farmer accounts —
-- admin accounts are never selectable at signup (see docs/SECURITY.md).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'buyer')::public.user_role;
  if requested_role = 'admin' then
    requested_role := 'buyer';
  end if;

  insert into public.users (id, name, email, phone, role, county, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    requested_role,
    new.raw_user_meta_data->>'county',
    new.raw_user_meta_data->>'location'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- farmer_profiles
-- ─────────────────────────────────────────────────────────────────────────

create table public.farmer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  farm_name text not null,
  county text not null,
  subcounty text,
  location text,
  farm_description text,
  main_crops text[] not null default '{}',
  farm_image text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index farmer_profiles_verification_idx on public.farmer_profiles(verification_status);
create index farmer_profiles_county_idx on public.farmer_profiles(county);

create trigger farmer_profiles_set_updated_at
  before update on public.farmer_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- categories
-- ─────────────────────────────────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- products
-- ─────────────────────────────────────────────────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  price_unit text not null,
  quantity_available numeric(10, 2) not null default 0 check (quantity_available >= 0),
  quantity_unit text not null,
  min_order_quantity numeric(10, 2) not null default 1 check (min_order_quantity > 0),
  images text[] not null default '{}',
  harvest_date date,
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farmer_id, slug)
);

create index products_farmer_idx on public.products(farmer_id);
create index products_category_idx on public.products(category_id);
create index products_status_idx on public.products(status);
create index products_name_trgm_idx on public.products using gin (to_tsvector('english', name));

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- carts / cart_items
-- ─────────────────────────────────────────────────────────────────────────

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null unique references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(10, 2) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- orders / order_items
-- ─────────────────────────────────────────────────────────────────────────

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  platform_fee numeric(10, 2) not null default 0 check (platform_fee >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  payment_status public.payment_status not null default 'PENDING',
  order_status public.order_status not null default 'PENDING_PAYMENT',
  delivery_county text not null,
  delivery_address text not null,
  delivery_notes text,
  buyer_name text not null,
  buyer_phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_buyer_idx on public.orders(buyer_id);
create index orders_status_idx on public.orders(order_status);
create index orders_payment_status_idx on public.orders(payment_status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- order_items snapshot product data at purchase time so historical orders
-- stay accurate even if the product is later edited or deleted.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  farmer_id uuid not null references public.farmer_profiles(id),
  product_name_snapshot text not null,
  price_at_purchase numeric(10, 2) not null check (price_at_purchase >= 0),
  quantity numeric(10, 2) not null check (quantity > 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);
create index order_items_farmer_idx on public.order_items(farmer_id);

-- ─────────────────────────────────────────────────────────────────────────
-- payments
-- ─────────────────────────────────────────────────────────────────────────

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  buyer_id uuid not null references public.users(id),
  amount numeric(10, 2) not null check (amount >= 0),
  phone_number text not null,
  status public.payment_status not null default 'PENDING',
  merchant_request_id text,
  checkout_request_id text unique,
  mpesa_receipt_number text unique,
  result_code integer,
  result_description text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index payments_order_idx on public.payments(order_id);
create index payments_buyer_idx on public.payments(buyer_id);
create index payments_checkout_request_idx on public.payments(checkout_request_id);

-- ─────────────────────────────────────────────────────────────────────────
-- deliveries (transporter_id reserved for the future transporter role)
-- ─────────────────────────────────────────────────────────────────────────

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  transporter_id uuid references public.users(id),
  pickup_location text not null,
  delivery_location text not null,
  delivery_fee numeric(10, 2) not null default 0,
  status public.delivery_status not null default 'UNASSIGNED',
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- reviews
-- ─────────────────────────────────────────────────────────────────────────

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  buyer_id uuid not null references public.users(id),
  farmer_id uuid not null references public.farmer_profiles(id),
  product_id uuid references public.products(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index reviews_farmer_idx on public.reviews(farmer_id);
create index reviews_product_idx on public.reviews(product_id);

-- ─────────────────────────────────────────────────────────────────────────
-- disputes
-- ─────────────────────────────────────────────────────────────────────────

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  user_id uuid not null references public.users(id),
  reason text not null,
  description text not null,
  evidence text[] not null default '{}',
  status public.dispute_status not null default 'open',
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index disputes_order_idx on public.disputes(order_id);
create index disputes_status_idx on public.disputes(status);

create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- audit_logs
-- ─────────────────────────────────────────────────────────────────────────

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs(actor_id);

-- ─────────────────────────────────────────────────────────────────────────
-- platform_settings (singleton row)
-- ─────────────────────────────────────────────────────────────────────────

create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  platform_fee_percent numeric(5, 2) not null default 5.00 check (
    platform_fee_percent >= 0 and platform_fee_percent <= 100
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

insert into public.platform_settings (id, platform_fee_percent) values (1, 5.00);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Inventory: atomic, race-safe deduction
--
-- Two concurrent buyers checking out against the same 10kg of stock must
-- never both succeed. Postgres row locking makes a single UPDATE with a
-- WHERE-guard atomic: the second concurrent caller sees the row only after
-- the first UPDATE's effects are visible, so its own WHERE clause fails.
-- This function is only ever called from server-side code (the M-PESA
-- callback handler) after payment has been confirmed as PAID — never from
-- checkout — using the service-role client.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.deduct_product_inventory(
  p_product_id uuid,
  p_quantity numeric
) returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_updated_rows integer;
begin
  update public.products
  set quantity_available = quantity_available - p_quantity,
      status = case
        when quantity_available - p_quantity <= 0 then 'sold_out'::public.product_status
        else status
      end
  where id = p_product_id
    and quantity_available >= p_quantity;

  get diagnostics v_updated_rows = row_count;
  return v_updated_rows = 1;
end;
$$;

revoke execute on function public.deduct_product_inventory(uuid, numeric) from public, anon, authenticated;
