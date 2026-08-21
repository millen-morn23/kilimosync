import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/data/current-user";
import { AiChat } from "@/components/ai/ai-chat";

export const metadata: Metadata = { title: "KilimoSync AI" };

const BUYER_SUGGESTIONS = [
  "What vegetables are available right now?",
  "Show me tomatoes under KES 100 per kg",
  "Find produce from Nakuru county",
  "What's the status of my last order?",
];

const FARMER_SUGGESTIONS = [
  "Which of my products are low in stock?",
  "Summarize my sales so far",
  "Help me write a listing for my potatoes",
  "What are my active listings?",
];

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin/assistant");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">KilimoSync AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {user.role === "farmer"
          ? "Ask about your listings and sales, or get help drafting a new one."
          : "Ask about produce on the marketplace or your own orders."}
      </p>
      <div className="mt-6">
        <AiChat suggestions={user.role === "farmer" ? FARMER_SUGGESTIONS : BUYER_SUGGESTIONS} />
      </div>
    </div>
  );
}
