"use client";

import { useState } from "react";
import { Bot, LoaderCircle } from "lucide-react";

type DraftResponse = {
  confidence?: {
    score: number;
    label: string;
    reasons: string[];
    recommended_status: string;
  };
  product_identity?: {
    canonical_name: string;
    identity_confidence: number;
  };
};

export function ProductAiDraftPanel() {
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestDraft(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form");
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    setIsLoading(true);
    setError(null);
    setDraft(null);

    const response = await fetch("/api/ai/product-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productName: formData.get("productName"),
        brand: formData.get("brand"),
        category: formData.get("category"),
        model: formData.get("model"),
        supplierUrl: formData.get("supplierUrl"),
        region: "New Zealand",
      }),
    });

    if (!response.ok) {
      setIsLoading(false);
      setError("Add at least a product name before drafting.");
      return;
    }

    setDraft((await response.json()) as DraftResponse);
    setIsLoading(false);
  }

  return (
    <div className="space-y-3">
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        disabled={isLoading}
        onClick={requestDraft}
        type="button"
      >
        {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
        Draft with AI
      </button>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
      ) : null}

      {draft ? (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
          <p className="font-semibold">
            Draft score: {draft.confidence?.score}% - {draft.confidence?.label}
          </p>
          <p className="mt-1 text-cyan-800">Status: {draft.confidence?.recommended_status}</p>
          <ul className="mt-3 space-y-1 text-cyan-800">
            {draft.confidence?.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
