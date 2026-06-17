"use client";

import { useState } from "react";
import { Bot, ExternalLink, LoaderCircle } from "lucide-react";

type DraftResponse = {
  confidence?: {
    score: number;
    label: string;
    reasons: string[];
    missing_fields: string[];
    recommended_status: string;
  };
  product_identity?: {
    canonical_name: string;
    brand: string;
    identity_confidence: number;
  };
  sources?: Array<{
    title: string;
    url: string;
    sourceType: string;
    official: boolean;
    nzSpecific: boolean;
  }>;
  warranty?: {
    period: string;
    void_conditions: string;
  };
  maintenance?: {
    requirements: string;
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
        location: formData.get("location"),
        notes: formData.get("notes"),
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
          <p className="mt-1 text-cyan-800">
            {draft.product_identity?.canonical_name}
            {draft.product_identity?.brand ? ` - ${draft.product_identity.brand}` : ""} · Status:{" "}
            {draft.confidence?.recommended_status}
          </p>
          <ul className="mt-3 space-y-1 text-cyan-800">
            {draft.confidence?.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          {draft.sources?.length ? (
            <div className="mt-4 rounded-md border border-cyan-200 bg-white p-3">
              <p className="font-semibold text-slate-950">Source-backed draft fields</p>
              <div className="mt-2 space-y-2">
                {draft.sources.map((source) => (
                  <a
                    className="flex items-start gap-2 text-cyan-800 underline"
                    href={source.url}
                    key={`${source.title}-${source.url}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {source.title}
                      {source.official ? " · official" : ""}
                      {source.nzSpecific ? " · NZ" : ""}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {draft.warranty?.period || draft.maintenance?.requirements ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-cyan-200 bg-white p-3">
                <p className="font-semibold text-slate-950">Warranty draft</p>
                <p className="mt-1 text-cyan-800">
                  {draft.warranty?.period || "Warranty terms still need review."}
                </p>
              </div>
              <div className="rounded-md border border-cyan-200 bg-white p-3">
                <p className="font-semibold text-slate-950">Maintenance draft</p>
                <p className="mt-1 text-cyan-800">
                  {draft.maintenance?.requirements || "Maintenance requirements still need review."}
                </p>
              </div>
            </div>
          ) : null}
          {draft.confidence?.missing_fields.length ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <p className="font-semibold text-amber-950">Still missing</p>
              <ul className="mt-2 space-y-1">
                {draft.confidence.missing_fields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
