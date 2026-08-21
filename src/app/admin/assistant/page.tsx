import type { Metadata } from "next";

import { AiChat } from "@/components/ai/ai-chat";

export const metadata: Metadata = { title: "KilimoSync AI — Admin" };

const ADMIN_SUGGESTIONS = [
  "How many farmers are pending verification?",
  "What's our transaction value so far?",
  "How many payments have failed?",
  "How many buyers do we have?",
];

export default function AdminAssistantPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">KilimoSync AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask about platform-wide activity. Verification, fee changes, and other admin actions
        still happen in the dashboard — the assistant can&apos;t perform them.
      </p>
      <div className="mt-6">
        <AiChat suggestions={ADMIN_SUGGESTIONS} />
      </div>
    </div>
  );
}
