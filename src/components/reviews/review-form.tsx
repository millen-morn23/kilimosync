"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { createReview } from "@/lib/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReviewForm({ orderItemId, productName }: { orderItemId: string; productName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-sm text-success">Thanks for rating {productName}!</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Choose a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createReview({ orderItemId, rating, comment });
    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm font-medium text-foreground">Rate {productName}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            className="p-0.5"
          >
            <Star
              className={`size-5 ${value <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
