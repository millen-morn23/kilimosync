-- ─────────────────────────────────────────────────────────────────────────
-- KilimoSync AI usage log (Phase 4)
--
-- Every request to the AI chat endpoint is logged here — required by
-- docs/AI.md §Cost / abuse control ("log every request... for cost
-- monitoring and abuse investigation") and doubles as the backing store
-- for the per-user rate limit (src/app/api/ai/chat/route.ts counts a
-- user's rows in the last 60 seconds before allowing another request).
-- Written exclusively by the AI route handler via the service-role
-- client, after the caller's identity/role has already been verified via
-- the RLS-respecting client — same pattern as audit_logs.
-- ─────────────────────────────────────────────────────────────────────────

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  role public.user_role not null,
  message_preview text not null,
  tool_calls jsonb not null default '[]'::jsonb,
  input_tokens integer,
  output_tokens integer,
  error text,
  created_at timestamptz not null default now()
);

create index ai_usage_logs_user_created_idx on public.ai_usage_logs (user_id, created_at desc);

alter table public.ai_usage_logs enable row level security;

-- Admin-only read (cost/abuse monitoring). No insert/update/delete policy
-- for any client role — see header comment.
create policy "ai_usage_logs_admin_select" on public.ai_usage_logs
  for select using (public.is_admin());
