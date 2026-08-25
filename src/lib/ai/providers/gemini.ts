import "server-only";

import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { ZodError } from "zod";

import { getGeminiConfig, AI_LIMITS } from "@/lib/ai/config";
import { systemPromptForRole } from "@/lib/ai/system-prompts";
import { findTool, toolsForRole, type Tool, type ToolContext } from "@/lib/ai/tools";
import type { AgentResult, ChatMessage, ProductDraft } from "@/lib/ai/types";

// Gemini's FunctionDeclaration accepts a plain JSON Schema via
// `parametersJsonSchema` (mutually exclusive with the stricter, enum-typed
// `parameters` field) — so every tool's existing `inputSchema` from
// src/lib/ai/tools.ts is reused as-is, with no format conversion, same as
// it's passed to Anthropic as `input_schema`. Omitted entirely for
// no-argument tools, matching Gemini's documented convention.
function toFunctionDeclaration(tool: Tool): FunctionDeclaration {
  const hasProperties =
    tool.inputSchema &&
    typeof tool.inputSchema.properties === "object" &&
    tool.inputSchema.properties !== null &&
    Object.keys(tool.inputSchema.properties as object).length > 0;

  return {
    name: tool.name,
    description: tool.description,
    ...(hasProperties ? { parametersJsonSchema: tool.inputSchema } : {}),
  };
}

/**
 * Runs the same tool-calling loop as src/lib/ai/agent.ts's Anthropic path,
 * against Gemini instead. Reuses the identical role-scoped tools
 * (src/lib/ai/tools.ts) and system prompts (src/lib/ai/system-prompts.ts)
 * unchanged — only the provider request/response shape differs. The model
 * never sees a raw DB client here either; every tool call still goes
 * through tools.ts, which re-derives the caller's role/identity from ctx.
 */
export async function runAgentGemini(history: ChatMessage[], ctx: ToolContext): Promise<AgentResult> {
  const config = getGeminiConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const tools = toolsForRole(ctx.role);
  const functionDeclarations = tools.map(toFunctionDeclaration);

  const contents: Content[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolCallsMade: string[] = [];
  let draft: ProductDraft | null = null;

  for (let iteration = 0; iteration < AI_LIMITS.maxToolIterations; iteration++) {
    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: {
          systemInstruction: systemPromptForRole(ctx.role),
          tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined,
        },
      });
    } catch (err) {
      console.error("KilimoSync AI (Gemini): request failed", err);
      return { ok: false, error: "KilimoSync AI is temporarily unavailable. Please try again." };
    }

    totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0;
    totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

    const functionCalls = response.functionCalls ?? [];

    if (functionCalls.length === 0) {
      const text = (response.text ?? "").trim();
      return {
        ok: true,
        reply: text || "I don't have anything to add on that.",
        draft,
        toolCalls: toolCallsMade,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responseParts: Part[] = [];
    for (const call of functionCalls) {
      const name = call.name ?? "";
      toolCallsMade.push(name);

      const tool = findTool(name, ctx.role);
      if (!tool) {
        responseParts.push({
          functionResponse: { name, response: { error: "Tool not available for this role." } },
        });
        continue;
      }

      try {
        const result = await tool.run(call.args ?? {}, ctx);
        if (tool.name === "create_product_draft" && result && typeof result === "object" && "draft" in result) {
          draft = (result as { draft: ProductDraft }).draft;
        }
        responseParts.push({ functionResponse: { name: tool.name, response: { result } } });
      } catch (err) {
        // Same distinction as the Anthropic path: a Zod failure means the
        // model's input was invalid; anything else is a real backend
        // failure and shouldn't be reported to the model as its mistake.
        if (err instanceof ZodError) {
          responseParts.push({
            functionResponse: { name: tool.name, response: { error: "Invalid input for this tool." } },
          });
        } else {
          console.error(`KilimoSync AI (Gemini): tool "${tool.name}" failed`, err);
          responseParts.push({
            functionResponse: {
              name: tool.name,
              response: { error: "Temporarily unable to fetch that data. Try again shortly." },
            },
          });
        }
      }
    }

    contents.push({ role: "user", parts: responseParts });
  }

  return { ok: false, error: "KilimoSync AI took too long to respond. Please try a simpler question." };
}
