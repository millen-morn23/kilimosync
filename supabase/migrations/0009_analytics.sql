-- ─────────────────────────────────────────────────────────────────────────
-- Phase 5.5 — admin analytics
--
-- All aggregation happens in Postgres, not in the Node process, so a
-- growing orders table never means pulling every row into the browser (or
-- even into the server) just to sum it (see docs/ARCHITECTURE.md
-- §Analytics). Every function below is `security invoker` — deliberately
-- NOT security definer like the M-PESA functions — so it runs with the
-- CALLER's own RLS. An admin sees full platform data because `is_admin()`
-- already grants that in every underlying table's SELECT policy; anyone
-- else gets back near-empty results (whatever their own RLS-visible rows
-- happen to aggregate to), not an error and not another user's data. That
-- makes RLS the actual boundary here too, not a page-level check.
--
-- Financial definitions (see docs/DATABASE.md §Analytics for the full
-- writeup): "gross transaction value" and "platform revenue" are always
-- computed from orders.payment_status = 'PAID' — a verified, completed
-- payment — never from an order that merely exists or a payment attempt
-- that failed/was cancelled/timed out. GTV sums `subtotal` (the value of
-- goods actually sold); platform revenue sums `platform_fee` (the
-- commission actually earned). Delivery fees are pass-through and
-- included in neither.
-- ─────────────────────────────────────────────────────────────────────────

create index orders_created_at_idx on public.orders(created_at);
create index orders_delivery_county_idx on public.orders(delivery_county);
create index order_items_product_idx on public.order_items(product_id);
create index users_created_at_idx on public.users(created_at);
create index farmer_profiles_verified_at_idx on public.farmer_profiles(verified_at);
create index payments_status_idx on public.payments(status);

-- Overview KPI row (all-time totals — not date-filtered, matching the
-- product brief's "Total X" phrasing for these specific metrics).
create or replace function public.admin_analytics_overview()
returns table (
  total_users bigint,
  total_farmers bigint,
  verified_farmers bigint,
  pending_farmers bigint,
  total_buyers bigint,
  active_products bigint,
  total_orders bigint,
  completed_orders bigint,
  cancelled_orders bigint,
  gross_transaction_value numeric,
  platform_revenue numeric,
  successful_payments bigint,
  failed_payments bigint,
  open_disputes bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.users) as total_users,
    (select count(*) from public.users where role = 'farmer') as total_farmers,
    (select count(*) from public.farmer_profiles where verification_status = 'verified') as verified_farmers,
    (select count(*) from public.farmer_profiles where verification_status = 'pending') as pending_farmers,
    (select count(*) from public.users where role = 'buyer') as total_buyers,
    (select count(*) from public.products where status = 'active') as active_products,
    (select count(*) from public.orders) as total_orders,
    (select count(*) from public.orders where order_status = 'COMPLETED') as completed_orders,
    (select count(*) from public.orders where order_status = 'CANCELLED') as cancelled_orders,
    (select coalesce(sum(subtotal), 0) from public.orders where payment_status = 'PAID') as gross_transaction_value,
    (select coalesce(sum(platform_fee), 0) from public.orders where payment_status = 'PAID') as platform_revenue,
    (select count(*) from public.payments where status = 'PAID') as successful_payments,
    (select count(*) from public.payments where status in ('FAILED', 'CANCELLED', 'TIMEOUT')) as failed_payments,
    (select count(*) from public.disputes where status in ('open', 'investigating')) as open_disputes;
$$;

revoke execute on function public.admin_analytics_overview() from public, anon;
grant execute on function public.admin_analytics_overview() to authenticated;

-- Orders/GTV/revenue bucketed over [p_start, p_end). p_bucket is 'day',
-- 'week', or 'month' — validated by the caller (src/lib/data/analytics.ts)
-- against that exact set, though an invalid value here would simply error
-- rather than do anything unsafe (it's passed to date_trunc as a plain
-- function argument, never string-concatenated into SQL).
create or replace function public.admin_orders_over_time(
  p_start timestamptz,
  p_end timestamptz,
  p_bucket text default 'day',
  p_county text default null,
  p_statuses public.order_status[] default null
)
returns table (
  bucket date,
  total_orders bigint,
  paid_orders bigint,
  gross_value numeric,
  platform_revenue numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc(p_bucket, o.created_at)::date as bucket,
    count(*) as total_orders,
    count(*) filter (where o.payment_status = 'PAID') as paid_orders,
    coalesce(sum(o.subtotal) filter (where o.payment_status = 'PAID'), 0) as gross_value,
    coalesce(sum(o.platform_fee) filter (where o.payment_status = 'PAID'), 0) as platform_revenue
  from public.orders o
  where o.created_at >= p_start
    and o.created_at < p_end
    and (p_county is null or o.delivery_county = p_county)
    and (p_statuses is null or o.order_status = any(p_statuses))
  group by 1
  order by 1;
$$;

revoke execute on function public.admin_orders_over_time(timestamptz, timestamptz, text, text, public.order_status[])
  from public, anon;
grant execute on function public.admin_orders_over_time(timestamptz, timestamptz, text, text, public.order_status[])
  to authenticated;

-- New buyers / new farmers / newly-verified farmers, bucketed. Uses
-- generate_series so a zero-activity bucket still appears as a real 0
-- point rather than a gap in the chart.
create or replace function public.admin_user_growth(
  p_start timestamptz,
  p_end timestamptz,
  p_bucket text default 'day'
)
returns table (
  bucket date,
  new_buyers bigint,
  new_farmers bigint,
  newly_verified_farmers bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.bucket,
    coalesce(u.new_buyers, 0) as new_buyers,
    coalesce(u.new_farmers, 0) as new_farmers,
    coalesce(v.newly_verified, 0) as newly_verified_farmers
  from generate_series(
    date_trunc(p_bucket, p_start),
    date_trunc(p_bucket, p_end - interval '1 second'),
    ('1 ' || p_bucket)::interval
  ) as b(bucket)
  left join (
    select
      date_trunc(p_bucket, created_at)::date as bucket,
      count(*) filter (where role = 'buyer') as new_buyers,
      count(*) filter (where role = 'farmer') as new_farmers
    from public.users
    where created_at >= p_start and created_at < p_end
    group by 1
  ) u on u.bucket = b.bucket::date
  left join (
    select date_trunc(p_bucket, verified_at)::date as bucket, count(*) as newly_verified
    from public.farmer_profiles
    where verified_at >= p_start and verified_at < p_end
    group by 1
  ) v on v.bucket = b.bucket::date
  order by b.bucket;
$$;

revoke execute on function public.admin_user_growth(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_user_growth(timestamptz, timestamptz, text) to authenticated;

-- Best-selling products by revenue within [p_start, p_end), PAID orders
-- only. Joins through order_items so a since-deleted or edited product
-- still shows correctly under its name at time of sale
-- (product_name_snapshot) — see docs/DATABASE.md's note on order_items.
create or replace function public.admin_top_products(
  p_start timestamptz,
  p_end timestamptz,
  p_category_id uuid default null,
  p_county text default null,
  p_limit integer default 10
)
returns table (
  product_id uuid,
  product_name text,
  category_name text,
  units_sold numeric,
  revenue numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    oi.product_id,
    oi.product_name_snapshot as product_name,
    coalesce(c.name, 'Uncategorized') as category_name,
    sum(oi.quantity) as units_sold,
    sum(oi.subtotal) as revenue
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  left join public.categories c on c.id = p.category_id
  where o.payment_status = 'PAID'
    and o.created_at >= p_start
    and o.created_at < p_end
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_county is null or o.delivery_county = p_county)
  group by oi.product_id, oi.product_name_snapshot, c.name
  order by revenue desc
  limit p_limit;
$$;

revoke execute on function public.admin_top_products(timestamptz, timestamptz, uuid, text, integer)
  from public, anon;
grant execute on function public.admin_top_products(timestamptz, timestamptz, uuid, text, integer)
  to authenticated;

-- Same shape, grouped by category instead of product.
create or replace function public.admin_top_categories(
  p_start timestamptz,
  p_end timestamptz,
  p_county text default null,
  p_limit integer default 10
)
returns table (
  category_id uuid,
  category_name text,
  order_count bigint,
  units_sold numeric,
  transaction_value numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id as category_id,
    coalesce(c.name, 'Uncategorized') as category_name,
    count(distinct oi.order_id) as order_count,
    sum(oi.quantity) as units_sold,
    sum(oi.subtotal) as transaction_value
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  left join public.categories c on c.id = p.category_id
  where o.payment_status = 'PAID'
    and o.created_at >= p_start
    and o.created_at < p_end
    and (p_county is null or o.delivery_county = p_county)
  group by c.id, c.name
  order by transaction_value desc
  limit p_limit;
$$;

revoke execute on function public.admin_top_categories(timestamptz, timestamptz, text, integer)
  from public, anon;
grant execute on function public.admin_top_categories(timestamptz, timestamptz, text, integer)
  to authenticated;

-- All-time, all counties (union of everywhere a farmer is based and
-- everywhere an order has ever been delivered), so a county with farmers
-- but no orders yet — or vice versa — still shows up with real zeros
-- instead of being silently absent.
create or replace function public.admin_county_activity()
returns table (
  county text,
  farmer_count bigint,
  buyer_count bigint,
  order_count bigint,
  transaction_value numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.county,
    (select count(*) from public.farmer_profiles fp where fp.county = c.county) as farmer_count,
    (select count(distinct o.buyer_id) from public.orders o where o.delivery_county = c.county) as buyer_count,
    (select count(*) from public.orders o where o.delivery_county = c.county) as order_count,
    (
      select coalesce(sum(o.subtotal), 0)
      from public.orders o
      where o.delivery_county = c.county and o.payment_status = 'PAID'
    ) as transaction_value
  from (
    select county from public.farmer_profiles
    union
    select delivery_county as county from public.orders
  ) c
  order by transaction_value desc;
$$;

revoke execute on function public.admin_county_activity() from public, anon;
grant execute on function public.admin_county_activity() to authenticated;
