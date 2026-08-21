"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ProductDraft = { name: string; description: string; suggestedPrice?: number; suggestedUnit?: string };

export function AiChat({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setDraft(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-20) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "KilimoSync AI is unavailable right now.");
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      if (data.draft) setDraft(data.draft);
    } catch {
      setError("Could not reach KilimoSync AI. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-border bg-background">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="size-8 text-primary" />
            <p className="text-sm text-muted-foreground">Ask KilimoSync AI anything about your account.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent">
              {message.role === "user" ? (
                <User className="size-4 text-foreground" />
              ) : (
                <Bot className="size-4 text-primary" />
              )}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Thinking…
          </div>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {draft && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-2 py-4">
              <p className="text-sm font-medium text-foreground">Draft listing: {draft.name}</p>
              <p className="text-sm text-muted-foreground">{draft.description}</p>
              <p className="text-xs text-muted-foreground">
                Nothing has been saved. Review and complete it in the product form.
              </p>
              <Button size="sm" asChild>
                <Link
                  href={`/dashboard/farmer/products/new?name=${encodeURIComponent(draft.name)}&description=${encodeURIComponent(draft.description)}`}
                >
                  Open in product form
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border p-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask KilimoSync AI…"
          disabled={loading}
          maxLength={1000}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}
