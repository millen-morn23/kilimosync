import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { ZodError } from "zod";

import { getAiConfig, AI_LIMITS } from "@/lib/ai/config";
import { systemPromptForRole } from "@/lib/ai/system-prompts";
import { findTool, toolsForRole, type ToolContext } from "@/lib/ai/tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ProductDraft = {
  name: string;
  description: string;
  suggestedPrice?: number;
  suggestedUnit?: string;
};

export type AgentResult =
  | {
      ok: true;
      reply: string;
      draft: ProductDraft | null;
      toolCalls: string[];
      inputTokens: number;
      outputTokens: number;
    }
  | { ok: false; error: string };

/**
 * Runs the tool-calling loop server-side. The model never sees a raw DB
 * client — every tool call goes through src/lib/ai/tools.ts, which
 * re-derives the caller's role/identity from ctx (never from anything the
 * model says) before touching data. See docs/AI.md.
 */
export async function runAgent(
  history: ChatMessage[],
  ctx: ToolContext
): Promise<AgentResult> {
  const config = getAiConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const client = new Anthropic({ apiKey: config.apiKey });
  const tools = toolsForRole(ctx.role);
  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolCallsMade: string[] = [];
  let draft: ProductDraft | null = null;

  for (let iteration = 0; iteration < AI_LIMITS.maxToolIterations; iteration++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: config.model,
        max_tokens: 1024,
        system: systemPromptForRole(ctx.role),
        messages,
        tools: anthropicTools,
      });
    } catch (err) {
      console.error("KilimoSync AI: Anthropic request failed", err);
      return { ok: false, error: "KilimoSync AI is temporarily unavailable. Please try again." };
    }

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return {
        ok: true,
        reply: text || "I don't have anything to add on that.",
        draft,
        toolCalls: toolCallsMade,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      toolCallsMade.push(block.name);

      const tool = findTool(block.name, ctx.role);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ error: "Tool not available for this role." }),
          is_error: true,
        });
        continue;
      }

      try {
        const result = await tool.run(block.input, ctx);
        if (tool.name === "create_product_draft" && result && typeof result === "object" && "draft" in result) {
          draft = (result as { draft: ProductDraft }).draft;
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        // Only a Zod parse failure genuinely means "the model's input was
        // invalid" — anything else (a Supabase error, a bug in a data
        // helper) is a real backend failure and shouldn't be reported to
        // the model as if the caller made a mistake.
        if (err instanceof ZodError) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: "Invalid input for this tool." }),
            is_error: true,
          });
        } else {
          console.error(`KilimoSync AI: tool "${tool.name}" failed`, err);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: "Temporarily unable to fetch that data. Try again shortly." }),
            is_error: true,
          });
        }
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return { ok: false, error: "KilimoSync AI took too long to respond. Please try a simpler question." };
}
