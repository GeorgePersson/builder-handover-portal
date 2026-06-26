"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  FileUp,
  LoaderCircle,
  Search,
} from "lucide-react";

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
    size?: number;
    pages: number;
    text_length: number;
  };
  extraction?: {
    table_count: number;
    chunk_count: number;
    average_characters_per_page: number;
    ocr_page_count?: number;
    ocr_character_count?: number;
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
type ActiveOperation = "process-pdf" | "preview-pdf" | "preview-text" | "save-preview" | null;
type SaveMessage = {
  text: string;
  tone: "success" | "warning";
  showReviewLink: boolean;
};

const operationLabels: Record<Exclude<ActiveOperation, null>, string> = {
  "preview-pdf": "Previewing PDF extraction",
  "preview-text": "Previewing pasted text",
  "process-pdf": "Processing PDF to review",
  "save-preview": "Sending preview to review",
};

const operationSteps: Record<Exclude<ActiveOperation, null>, string[]> = {
  "preview-pdf": ["Reading PDF", "Extracting text, tables, and OCR fallback", "Drafting proposed items"],
  "preview-text": ["Reading pasted text", "Drafting proposed items", "Preparing preview"],
  "process-pdf": ["Uploading PDF", "Extracting text, tables, and OCR fallback", "Saving proposed items"],
  "save-preview": ["Preparing saved extraction", "Writing review items", "Refreshing queue state"],
};

function formatFileSize(bytes?: number) {
  if (!bytes) {
    return "Unknown size";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtractionQuality(result: SpecExtractResponse) {
  const warnings = result.extraction?.warnings ?? [];
  const averageCharactersPerPage = result.extraction?.average_characters_per_page ?? 0;

  if (warnings.some((warning) => warning.toLowerCase().includes("scanned"))) {
    return {
      label: "Needs OCR",
      tone: "amber",
      description: "The file may be image-only, so extracted proposals should be checked closely.",
    };
  }

  if ((result.extraction?.ocr_page_count ?? 0) > 0) {
    return {
      label: "OCR assisted",
      tone: "amber",
      description: "Sparse pages needed OCR fallback. Check extracted wording against the source PDF before approval.",
    };
  }

  if (warnings.length || averageCharactersPerPage < 300) {
    return {
      label: "Needs review",
      tone: "amber",
      description: "Some pages produced sparse text or limited table structure.",
    };
  }

  return {
    label: "Readable source",
    tone: "emerald",
    description: "The PDF produced enough selectable text for a normal extraction pass.",
  };
}

export function SpecExtractPanel({ projects }: { projects: ProjectOption[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "local-project");
  const [text, setText] = useState(
    "James Hardie Linea Weatherboard cladding. Clean exterior cladding annually. Include CCC and producer statements. Heat pump system to be confirmed.",
  );
  const [result, setResult] = useState<SpecExtractResponse | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [sourceFileName, setSourceFileName] = useState("Local specification demo.pdf");
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>(null);
  const [error, setError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const isLoading = activeOperation !== null;

  function readSelectedPdfFromInput() {
    return selectedPdf || pdfInputRef.current?.files?.[0] || null;
  }

  function handlePdfSelection(file: File | null) {
    setSelectedPdf(file);
    setError(null);
    if (file) {
      setSourceFileName(file.name);
    }
  }

  useEffect(() => {
    const file = pdfInputRef.current?.files?.[0] || null;

    if (file) {
      setSelectedPdf(file);
      setSourceFileName(file.name);
    }
  }, []);

  async function runExtraction() {
    setActiveOperation("preview-text");
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
      setActiveOperation(null);
      return;
    }

    setResult((await response.json()) as SpecExtractResponse);
    setResultMode("text-preview");
    setActiveOperation(null);
  }

  async function runPdfExtraction() {
    const pdf = readSelectedPdfFromInput();

    if (!pdf) {
      setError("Choose a PDF first.");
      return;
    }

    setActiveOperation("preview-pdf");
    setError(null);
    setResult(null);
    setResultMode(null);
    setSaveMessage(null);

    const formData = new FormData();
    formData.append("specificationPdf", pdf);

    const response = await fetch("/api/specifications/extract-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Could not extract the uploaded PDF.");
      setActiveOperation(null);
      return;
    }

    setResult((await response.json()) as SpecExtractResponse);
    setResultMode("preview");
    setActiveOperation(null);
  }

  async function processPdfToReviewQueue() {
    const pdf = readSelectedPdfFromInput();

    if (!pdf) {
      setError("Choose a PDF first.");
      return;
    }

    setActiveOperation("process-pdf");
    setError(null);
    setResult(null);
    setResultMode(null);
    setSaveMessage(null);

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("specificationPdf", pdf);

    const response = await fetch("/api/specifications/process-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string; detail?: string };
      const message = payload.error || "Could not process the uploaded PDF.";
      setError(payload.detail ? `${message} ${payload.detail}` : message);
      setActiveOperation(null);
      return;
    }

    const payload = (await response.json()) as SpecExtractResponse & {
      saved_count: number;
      storage: string;
    };
    setResult(payload);
    setResultMode("processed");
    if (payload.saved_count === 0) {
      setSaveMessage({
        text: "Processed PDF, but no valid handover items were found to send. Check the text preview below; this usually means the file is an admin/contract/supporting document rather than a project specification.",
        tone: "warning",
        showReviewLink: false,
      });
    } else {
      setSaveMessage({
        text: `Processed PDF and sent ${payload.saved_count} items to the ${payload.storage} review queue.`,
        tone: "success",
        showReviewLink: true,
      });
    }
    setActiveOperation(null);
  }

  async function saveToReviewQueue() {
    if (!result?.proposed_items?.length) {
      setError("Run an extraction preview first.");
      return;
    }

    setActiveOperation("save-preview");
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
      setActiveOperation(null);
      return;
    }

    const payload = (await response.json()) as { saved_count: number; storage: string };
    setResultMode("processed");
    setSaveMessage({
      text: `Sent ${payload.saved_count} items to the ${payload.storage} review queue.`,
      tone: "success",
      showReviewLink: true,
    });
    setActiveOperation(null);
  }

  const canProcessPdf = !isLoading;
  const isPreviewResult = resultMode === "preview" || resultMode === "text-preview";
  const progressSteps = activeOperation ? operationSteps[activeOperation] : [];
  const quality = result ? getExtractionQuality(result) : null;

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
                  handlePdfSelection(event.target.files?.[0] || null);
                }}
                onInput={(event) => {
                  handlePdfSelection(event.currentTarget.files?.[0] || null);
                }}
                ref={pdfInputRef}
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
                  {formatFileSize(selectedPdf.size)}
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
              {activeOperation === "process-pdf" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
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
              {activeOperation === "preview-pdf" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
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
            {activeOperation === "preview-text" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            Preview from text
          </button>
        </details>
      </div>

      {activeOperation ? (
        <div className="mt-4 rounded-md border border-cyan-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin text-cyan-700" />
            <p className="text-sm font-semibold text-slate-950">{operationLabels[activeOperation]}</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {progressSteps.map((step, index) => (
              <div
                className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
                key={step}
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-cyan-700 text-[11px] text-white">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {saveMessage ? (
        <div
          className={`mt-4 flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
            saveMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span>{saveMessage.text}</span>
          {saveMessage.showReviewLink ? (
            <Link className="font-semibold text-emerald-900 underline" href="/builder/specifications/review">
              Open review queue
            </Link>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-3">
          {result.file ? (
            <div className="rounded-md border border-cyan-200 bg-white p-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{result.file.name}</span> parsed with{" "}
              {result.file.pages} pages, {formatFileSize(result.file.size)}, and {result.file.text_length} characters of text.
            </div>
          ) : null}
          {quality ? (
            <div
              className={`rounded-md border p-3 text-sm ${
                quality.tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {quality.tone === "emerald" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{quality.label}</p>
                  <p className="mt-1 leading-6">{quality.description}</p>
                </div>
              </div>
            </div>
          ) : null}
          {result.extraction ? (
            <div className="grid gap-3 sm:grid-cols-4">
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
              <div className="rounded-md border border-cyan-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">OCR pages</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {result.extraction.ocr_page_count ?? 0}
                </p>
              </div>
            </div>
          ) : null}
          {result.extraction?.warnings.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold text-amber-950">Extraction warnings</p>
              {result.extraction.warnings.map((warning) => (
                <p className="mt-1 leading-6" key={warning}>
                  {warning}
                </p>
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
                {activeOperation === "save-preview" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Bot className="size-4" />
                )}
                Send to review queue
              </button>
            </div>
          ) : null}
          {result.proposed_items?.map((item, index) => (
            <div className="rounded-md border border-slate-200 bg-white p-4" key={`${item.item_type}-${item.title}-${item.location || "no-location"}-${index}`}>
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
