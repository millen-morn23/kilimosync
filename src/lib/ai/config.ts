import "server-only";

const DEFAULT_MODEL = "claude-sonnet-5";

export function getAiConfig(): { apiKey: string; model: string } | { error: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "KilimoSync AI is not configured in this environment." };
  }
  return { apiKey, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL };
}

export const AI_LIMITS = {
  maxMessageLength: 1000,
  maxHistoryMessages: 20,
  maxToolIterations: 4,
  requestsPerMinute: 8,
};
