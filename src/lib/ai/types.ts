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
