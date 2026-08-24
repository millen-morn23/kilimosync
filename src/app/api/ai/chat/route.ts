import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnFarmerProfile, isSupabaseConfigured } from "@/lib/data/current-user";
import { runAgent, type ChatMessage } from "@/lib/ai/agent";
import { AI_LIMITS } from "@/lib/ai/config";

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(AI_LIMITS.maxMessageLength),
      })
    )
    .min(1)
    .max(AI_LIMITS.maxHistoryMessages),
});

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!profile) {
      return NextResponse.json({ error: "Account not found." }, { status: 401 });
    }
    const role = profile.role;

    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const messages: ChatMessage[] = parsed.data.messages;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    // The service-role client backs rate limiting and usage logging only —
    // neither is essential to answering the request, so a missing/invalid
    // SUPABASE_SERVICE_ROLE_KEY degrades to "skip rate limiting, still
    // answer" instead of 500ing the whole AI feature.
    let admin: ReturnType<typeof createAdminClient> | null = null;
    try {
      admin = createAdminClient();
    } catch (err) {
      console.error("AI chat: admin client unavailable, skipping rate limit/logging", err);
    }

    if (admin) {
      // Rate limit: N requests per rolling 60s per user, backed by the log
      // table itself so it holds across serverless instances (see
      // docs/AI.md §Cost / abuse control).
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { count: recentCount } = await admin
        .from("ai_usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", oneMinuteAgo);

      if ((recentCount ?? 0) >= AI_LIMITS.requestsPerMinute) {
        return NextResponse.json(
          { error: "You're sending messages too quickly. Please wait a moment." },
          { status: 429 }
        );
      }
    }

    const farmerProfileId = role === "farmer" ? (await getOwnFarmerProfile())?.id ?? null : null;

    const result = await runAgent(messages, {
      supabase,
      userId: user.id,
      role,
      farmerProfileId,
    });

    if (admin) {
      await admin.from("ai_usage_logs").insert({
        user_id: user.id,
        role,
        message_preview: (lastUserMessage?.content ?? "").slice(0, 200),
        tool_calls: result.ok ? result.toolCalls.map((name) => ({ name })) : [],
        input_tokens: result.ok ? result.inputTokens : null,
        output_tokens: result.ok ? result.outputTokens : null,
        error: result.ok ? null : result.error,
      });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ reply: result.reply, draft: result.draft });
  } catch (err) {
    console.error("AI chat route failed", err);
    return NextResponse.json(
      { error: "KilimoSync AI is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
