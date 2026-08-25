import "server-only";

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export function getAiConfig(): { apiKey: string; model: string } | { error: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "KilimoSync AI is not configured in this environment." };
  }
  return { apiKey, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL };
}

export function getGeminiConfig(): { apiKey: string; model: string } | { error: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "Gemini is not configured in this environment." };
  }
  return { apiKey, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL };
}

/**
 * Picks which provider actually answers a chat request. Gemini is
 * preferred when configured (free-tier, no paid credits required);
 * Anthropic remains fully implemented and is used automatically whenever
 * GEMINI_API_KEY is absent — a real fallback, not dead code. See
 * docs/AI.md.
 */
export function getActiveAiProvider(): "gemini" | "anthropic" | { error: string } {
  if (!("error" in getGeminiConfig())) return "gemini";
  if (!("error" in getAiConfig())) return "anthropic";
  return { error: "KilimoSync AI is not configured in this environment." };
}

export const AI_LIMITS = {
  maxMessageLength: 1000,
  maxHistoryMessages: 20,
  maxToolIterations: 4,
  requestsPerMinute: 8,
};
