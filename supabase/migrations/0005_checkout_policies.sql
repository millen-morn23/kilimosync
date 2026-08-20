-- KilimoSync — checkout write policies (Phase 2)
--
-- Phase 1 only defined SELECT/UPDATE policies for orders and order_items,
-- documented as "created exclusively by server-side checkout logic." That
-- logic now exists (src/lib/actions/checkout.ts) and runs as the
-- authenticated buyer via the RLS-respecting client, not the service
-- role, so it needs explicit INSERT policies rather than relying on
-- service-role bypass. Money math (subtotal/fees/total) is still always
-- recomputed server-side from the database, never trusted from the
-- client — RLS here only controls *whose* order a row may belong to.

create policy "orders_insert_own" on public.orders
  for insert with check (buyer_id = auth.uid());

create policy "order_items_insert_own_order" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer_id = auth.uid()
    )
  );
