# KilimoSync AI

**Status: not yet implemented.** This document specifies the design so
Phase 4 can build directly against it. No AI integration code exists yet
— see `docs/ROADMAP.md`.

## Design

A single server-side AI layer (`src/lib/ai/` — not yet created) exposed to
three surfaces (buyer, farmer, admin dashboards) with different available
tools per role. The browser never calls an AI provider directly and never
holds an API key — every request goes through a Next.js Route Handler that
runs the tool-calling loop server-side using `ANTHROPIC_API_KEY`
(server-only, already reserved in `.env.example`).

## Tool-based access, not raw DB access

The model is never given a raw SQL or Supabase client. It calls a fixed,
validated set of server-side tools, each of which:

- Re-derives the caller's identity and role from the authenticated
  session (same `getCurrentUser()` used everywhere else) — never from
  anything the model claims about itself.
- Uses the RLS-respecting server client, so even a compromised or
  jailbroken prompt can't read data the caller's role wouldn't already be
  allowed to see.
- Validates its inputs with a Zod schema, same as any server action.

Planned tools:

| Tool | Role | Notes |
|---|---|---|
| `search_products` | buyer | Filters: query, category, price range, county. Reads only `status='active'` products. |
| `get_product` | buyer | Single product by id/slug. |
| `get_user_orders` | buyer | Own orders only — `buyer_id` comes from the session, never a model-supplied argument. |
| `get_farmer_products` | farmer | Own products only, via `owns_farmer_profile()`. |
| `get_farmer_sales` | farmer | Aggregates over the farmer's own `order_items`. |
| `create_product_draft` | farmer | Writes a *draft*, never publishes directly — the farmer must review and confirm in the UI before it becomes an active listing. |
| `get_platform_analytics` | admin | Gated by an explicit `role === 'admin'` check inside the tool, re-verified server-side — not inferred from which UI surface called it. |
| `create_notification` | server-internal | Not exposed to the model directly; used by other tools to notify a user of an action taken on their behalf. |

## Hard constraints

The AI must never: reveal passwords, API keys, or M-PESA credentials;
reveal another user's private data (phone numbers, addresses, order
details); access orders/products outside the caller's authorized scope;
confirm a payment without a verified `payments` row; modify financial
records; approve/verify a farmer automatically (verification stays a
human admin action — see `docs/SECURITY.md`); or invent marketplace data
that doesn't exist in `search_products`/`get_product` results. Every tool
result the model presents to a buyer must trace back to an actual row —
if a search returns no results, the assistant says so instead of
suggesting a plausible-sounding product.

## Cost / abuse control (required before launch)

- Every AI endpoint requires authentication — no anonymous usage.
- Rate limit per user (exact limits TBD in Phase 4 — e.g. N requests per
  minute).
- Bound prompt length and tool-result size before they're sent back into
  context.
- Log every request (user id, tool calls made, token counts) for cost
  monitoring and abuse investigation.
- Structured error handling — a provider failure returns a generic
  "assistant unavailable" message, never a stack trace or raw provider
  error to the user.
