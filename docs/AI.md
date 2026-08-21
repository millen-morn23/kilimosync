# KilimoSync AI

**Status: implemented, not yet run against a live provider.** All the
code below exists in this repository (`src/lib/ai/`,
`src/app/api/ai/chat/route.ts`, `src/components/ai/ai-chat.tsx`,
`supabase/migrations/0007_ai.sql`) and passes `npm run build`/`npm run
lint`, but this environment has no `ANTHROPIC_API_KEY` and no live
Supabase project, so **no conversation has actually been run against
Claude** — see below for exactly what was and wasn't verified.

## Design

A single server-side AI layer (`src/lib/ai/`) exposed to three surfaces
(`/dashboard/assistant` for buyer and farmer — it reads the caller's own
role and adjusts, `/admin/assistant` for admin) with different available
tools per role. The browser never calls Anthropic directly and never
holds an API key — every request goes through `src/app/api/ai/chat/route.ts`,
a Route Handler that runs the tool-calling loop server-side
(`src/lib/ai/agent.ts`, using `@anthropic-ai/sdk`) with `ANTHROPIC_API_KEY`
(server-only, `.env.example`; model configurable via `ANTHROPIC_MODEL`,
default `claude-sonnet-5`).

## Tool-based access, not raw DB access

The model is never given a raw SQL or Supabase client. It calls a fixed,
validated set of server-side tools (`src/lib/ai/tools.ts`), each of
which:

- Re-derives the caller's identity and role from the authenticated
  session (`request.auth.getUser()` in the route handler, passed down as
  `ToolContext` — never from anything the model claims about itself, and
  never from a model-supplied argument like a user id).
- Uses the RLS-respecting server client, so even a compromised or
  jailbroken prompt can't read data the caller's role wouldn't already be
  allowed to see.
- Validates its inputs with a Zod schema before touching data, same as
  any server action — `findTool()` also re-checks the tool is on the
  allow-list for the caller's role before running it, independent of
  which tools the model was offered in the request (defense in depth if
  that ever drifted).

Implemented tools:

| Tool | Role | Notes |
|---|---|---|
| `search_products` | buyer | Filters: query, category, price range, county. Reads only `status='active'` products via `getMarketplaceProducts()` — the same read path the public marketplace page uses. |
| `get_product` | buyer | Single product by slug, via `getProductBySlug()`. |
| `get_user_orders` | buyer | Own orders only — `getBuyerOrders()` derives `buyer_id` from the session inside the RLS client; the tool takes no id argument at all. |
| `get_farmer_products` | farmer | Own products only — `ctx.farmerProfileId`, resolved server-side from the session before the tool ever runs, not from the model. |
| `get_farmer_sales` | farmer | Aggregates over the farmer's own order lines (`getFarmerOrderLines()`). |
| `create_product_draft` | farmer | Returns a draft object in the tool result — **writes nothing to the database.** The chat UI renders it as a card linking to `/dashboard/farmer/products/new?name=...&description=...`, which pre-fills the real product form. The farmer still has to review every field and press "Create" — the exact same server action (`createProduct`) and validation as a listing typed in by hand. |
| `get_platform_analytics` | admin | Re-checks `ctx.role === 'admin'` inside the tool itself, not just via the route's role lookup — belt and suspenders. |

`create_notification` from the original design was dropped: nothing in
the current tool set needs to notify a user as a side effect yet
(notifications are Phase 5). It'll be added if/when a tool needs it,
rather than built speculatively now.

## Hard constraints

Enforced two ways — in the system prompt (`src/lib/ai/system-prompts.ts`,
one per role, all built on a shared rule block) *and*, more importantly,
structurally in the tools themselves, since a system prompt alone is not
a security boundary:

The AI must never: reveal passwords, API keys, or M-PESA credentials;
reveal another user's private data (phone numbers, addresses, order
details) — structurally impossible today since no tool accepts another
user's id as input; access orders/products outside the caller's
authorized scope — enforced by the RLS-respecting client inside every
tool, not just the prompt; confirm a payment without a verified
`payments` row — no payment-writing tool exists at all; modify financial
records — no tool has write access to `orders`/`payments`; approve/verify
a farmer automatically — no such tool exists; or invent marketplace data
that doesn't exist in `search_products`/`get_product` results — the
system prompt instructs this, and it's the one constraint here that
*is* prompt-level rather than structural, since "don't hallucinate" isn't
something a tool boundary can enforce. Every tool result is real data or
an explicit `{ error: ... }`/empty-result shape — never a fabricated stand-in.

## Cost / abuse control

- Every AI endpoint requires authentication — `isSupabaseConfigured()` +
  `auth.getUser()` gate `/api/ai/chat` before any tool or provider call;
  anonymous requests get a plain 401, matching how the rest of the app
  degrades with no Supabase project connected (see `docs/DEPLOYMENT.md`).
- Rate limit: 8 requests/minute/user (`AI_LIMITS.requestsPerMinute`,
  `src/lib/ai/config.ts`), enforced by counting the user's own rows in
  `ai_usage_logs` over the last 60 seconds — DB-backed rather than
  in-memory, so it holds correctly across serverless instances.
- Bounded input: 1000 chars/message, 20 messages of history per request
  (`AI_LIMITS.maxMessageLength`/`maxHistoryMessages`), enforced by a Zod
  schema on the request body before it reaches the model.
- Every request is logged to `ai_usage_logs` (user id, role, a 200-char
  message preview, the tool names called, input/output token counts, and
  any error) — admin-readable only (`ai_usage_logs_admin_select` RLS
  policy), written via the service-role client after identity is already
  verified through the RLS client, same pattern as `audit_logs`.
- Structured error handling: a provider failure, timeout, or missing
  `ANTHROPIC_API_KEY` returns a generic message
  ("KilimoSync AI is temporarily unavailable...") — never a stack trace
  or raw provider error to the user. Verified directly: with no
  `ANTHROPIC_API_KEY` configured, `getAiConfig()` returns a typed error
  instead of throwing, and hitting `/api/ai/chat` with no Supabase
  project configured returns a clean 401 rather than a 500 (see
  `docs/ROADMAP.md` Phase 4 for what this environment could and
  couldn't verify).
