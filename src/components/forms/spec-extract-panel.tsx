"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, FileText, FileUp, LoaderCircle, Search } from "lucide-react";

type ProjectOption = {
  id: string;
  name: string;
};

type ProposedItem = {
  item_type: string;
  title: string;
  category: string;
  location: string;
  confidence_score: number;
  matched_existing_record: string | null;
};

type SpecExtractResponse = {
  file?: {
    name: string;
    pages: number;
    text_length: number;
  };
  extraction?: {
    table_count: number;
    chunk_count: number;
    average_characters_per_page: number;
    warnings: string[];
  };
  text_preview?: string;
  summary?: {
    extracted_count: number;
    matched_existing_count: number;
    new_item_count: number;
    notes?: string[];
  };
  proposed_items?: ProposedItem[];
};

type ResultMode = "processed" | "preview" | "text-preview";

export function SpecExtractPanel({ projects }: { projects: ProjectOption[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "local-project");
  const [text, setText] = useState(
    "James Hardie Linea Weatherboard cladding. Clean exterior cladding annually. Include CCC and producer statements. Heat pump system to be confirmed.",
  );
  const [result, setResult] = useState<SpecExtractResponse | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [sourceFileName, setSourceFileName] = useState("Local specification demo.pdf");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runExtraction() {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setResultMode(null);
    setSaveMessage(null);

    const response = await fetch("/api/ai/spec-extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        fileName: "Local specification demo.pdf",
        extractedText: text,
      }),
    });

    if (!response.ok) {
      setError("Could not extract handover items from the supplied text.");
      setIsLoading(false);
      return;
    }

    setResult((await response.json()) as SpecExtractResponse);
    setResultMode("text-preview");
    setIsLoading(false);
  }

  async function runPdfExtraction() {
    if (!selectedPdf) {
      setError("Choose a PDF first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setResultMode(null);
    setSaveMessage(null);

    const formData = new FormData();
    formData.append("specificationPdf", selectedPdf);

    const response = await fetch("/api/specifications/extract-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Could not extract the uploaded PDF.");
      setIsLoading(false);
      return;
    }

    setResult((await response.json()) as SpecExtractResponse);
    setResultMode("preview");
    setIsLoading(false);
  }

  async function processPdfToReviewQueue() {
    if (!selectedPdf) {
      setError("Choose a PDF first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setResultMode(null);
    setSaveMessage(null);

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("specificationPdf", selectedPdf);

    const response = await fetch("/api/specifications/process-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Could not process the uploaded PDF.");
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as SpecExtractResponse & {
      saved_count: number;
      storage: string;
    };
    setResult(payload);
    setResultMode("processed");
    setSaveMessage(`Processed PDF and sent ${payload.saved_count} items to the ${payload.storage} review queue.`);
    setIsLoading(false);
  }

  async function saveToReviewQueue() {
    if (!result?.proposed_items?.length) {
      setError("Run an extraction preview first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSaveMessage(null);

    const response = await fetch("/api/specifications/save-extraction", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        fileName: result.file?.name || sourceFileName,
        proposedItems: result.proposed_items,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Could not send extraction to review.");
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as { saved_count: number; storage: string };
    setResultMode("processed");
    setSaveMessage(`Sent ${payload.saved_count} items to the ${payload.storage} review queue.`);
    setIsLoading(false);
  }

  const canProcessPdf = Boolean(selectedPdf) && !isLoading;
  const isPreviewResult = resultMode === "preview" || resultMode === "text-preview";

  return (
    <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-cyan-800">Recommended path</p>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-cyan-800">
              PDF to review queue
            </span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Build a handover package from a specification</h2>
          <p className="mt-2 text-sm leading-6 text-cyan-900">
            Select the project, upload the specification PDF, then send extracted products, documents,
            and maintenance items into builder review.
          </p>
        </div>
        <FileUp className="size-5 shrink-0 text-cyan-700" />
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-md border border-cyan-200 bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <label className="text-sm font-medium text-cyan-950">Project</label>
              <select
                className="mt-2 h-10 w-full rounded-md border border-cyan-200 bg-white px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                {projects.length ? (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                ) : (
                  <option value="local-project">Local demo project</option>
                )}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-cyan-950">Specification PDF</label>
              <input
                accept="application/pdf"
                className="mt-2 block w-full rounded-md border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedPdf(file);
                  if (file) {
                    setSourceFileName(file.name);
                  }
                }}
                type="file"
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="size-4 text-cyan-700" />
              <span className="text-sm font-semibold text-slate-950">
                {selectedPdf ? selectedPdf.name : "No PDF selected"}
              </span>
              {selectedPdf ? (
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {Math.max(1, Math.round(selectedPdf.size / 1024))} KB
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-3">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-cyan-700" />
                Upload PDF
              </span>
              <span className="inline-flex items-center gap-2">
                <Search className="size-3.5 text-cyan-700" />
                Extract text and tables
              </span>
              <span className="inline-flex items-center gap-2">
                <Bot className="size-3.5 text-cyan-700" />
                Send proposals to review
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canProcessPdf}
              onClick={processPdfToReviewQueue}
              type="button"
            >
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
              Process to review
            </button>
            <p className="text-xs leading-5 text-cyan-800">
              Processing saves the upload and sends proposed handover items to review in one step.
            </p>
          </div>
        </div>

        <details className="rounded-md border border-cyan-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-cyan-950">
            Advanced fallback tools
          </summary>
          <p className="mt-2 text-xs leading-5 text-cyan-800">
            Use preview-only extraction or pasted text for demos, debugging, or specs copied from email.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-300 bg-white px-4 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              disabled={!canProcessPdf}
              onClick={runPdfExtraction}
              type="button"
            >
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
              Preview PDF only
            </button>
          </div>
          <label className="mt-4 block text-sm font-medium text-cyan-950">Paste spec text</label>
          <textarea
            className="mt-2 min-h-40 w-full rounded-md border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
          <button
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800"
            disabled={isLoading}
            onClick={runExtraction}
            type="button"
          >
            {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
            Preview from text
          </button>
        </details>
      </div>

      {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {saveMessage ? (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{saveMessage}</span>
          <Link className="font-semibold text-emerald-900 underline" href="/builder/specifications/review">
            Open review queue
          </Link>
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-3">
          {result.file ? (
            <div className="rounded-md border border-cyan-200 bg-white p-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{result.file.name}</span> parsed with{" "}
              {result.file.pages} pages and {result.file.text_length} characters of text.
            </div>
          ) : null}
          {result.extraction ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-cyan-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Analysis chunks</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{result.extraction.chunk_count}</p>
              </div>
              <div className="rounded-md border border-cyan-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Detected tables</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{result.extraction.table_count}</p>
              </div>
              <div className="rounded-md border border-cyan-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Avg text/page</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {result.extraction.average_characters_per_page}
                </p>
              </div>
            </div>
          ) : null}
          {result.extraction?.warnings.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {result.extraction.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          {result.text_preview ? (
            <details className="rounded-md border border-cyan-200 bg-white p-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-semibold text-slate-950">Text preview</summary>
              <p className="mt-3 whitespace-pre-wrap leading-6">{result.text_preview}</p>
            </details>
          ) : null}
          {result.summary?.notes?.length ? (
            <div className="rounded-md border border-cyan-200 bg-white p-3 text-sm leading-6 text-slate-700">
              {result.summary.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
          <div className="rounded-md border border-cyan-200 bg-white p-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">{result.summary?.extracted_count}</span> extracted,{" "}
            <span className="font-semibold text-emerald-700">{result.summary?.matched_existing_count}</span> matched,{" "}
            <span className="font-semibold text-amber-700">{result.summary?.new_item_count}</span> new
          </div>
          {isPreviewResult ? (
            <div className="flex justify-end">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                disabled={isLoading}
                onClick={saveToReviewQueue}
                type="button"
              >
                {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
                Send to review queue
              </button>
            </div>
          ) : null}
          {result.proposed_items?.map((item) => (
            <div className="rounded-md border border-slate-200 bg-white p-4" key={`${item.item_type}-${item.title}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                  {item.item_type}
                </span>
                <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                  {item.confidence_score}% confidence
                </span>
              </div>
              <p className="mt-3 font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">
                {item.category} - {item.location}
              </p>
              {item.matched_existing_record ? (
                <p className="mt-2 text-sm text-emerald-700">Matched to {item.matched_existing_record}</p>
              ) : (
                <p className="mt-2 text-sm text-amber-700">New review item</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
