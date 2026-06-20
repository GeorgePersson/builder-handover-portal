type LlamaCloudFilePurpose = "parse" | "extract";

type LlamaCloudParseStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type LlamaCloudParseResult = {
  fileId: string;
  jobId: string;
  status: LlamaCloudParseStatus;
  markdown: string;
  text: string;
  raw: Record<string, unknown>;
};

type LlamaCloudUploadInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  purpose: LlamaCloudFilePurpose;
};

type LlamaCloudParseInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

const defaultBaseUrl = "https://api.cloud.llamaindex.ai";
const defaultParseTier = "agentic";
const defaultPollAttempts = 12;
const defaultPollIntervalMs = 2500;

function getApiKey() {
  return process.env.LLAMA_CLOUD_API_KEY?.trim() || "";
}

function getBaseUrl() {
  return (process.env.LLAMA_CLOUD_API_BASE_URL?.trim() || defaultBaseUrl).replace(/\/$/, "");
}

function getParseTier() {
  return process.env.LLAMA_CLOUD_PARSE_TIER?.trim() || defaultParseTier;
}

function getPollAttempts() {
  const parsed = Number.parseInt(process.env.LLAMA_CLOUD_POLL_ATTEMPTS || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPollAttempts;
}

function getPollIntervalMs() {
  const parsed = Number.parseInt(process.env.LLAMA_CLOUD_POLL_INTERVAL_MS || "", 10);
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : defaultPollIntervalMs;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getStatus(value: unknown): LlamaCloudParseStatus {
  const status = getString(value).toUpperCase();
  if (status === "PENDING" || status === "RUNNING" || status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
    return status;
  }

  return "PENDING";
}

function collectPageText(container: unknown, fieldName: string) {
  const rawPages = asRecord(container).pages;
  const pages: unknown[] = Array.isArray(rawPages) ? rawPages : [];
  return pages
    .map((page) => getString(asRecord(page)[fieldName]))
    .filter(Boolean)
    .join("\n\n");
}

function extractMarkdown(body: Record<string, unknown>) {
  const markdown = body.markdown;
  if (typeof markdown === "string") {
    return markdown;
  }

  return collectPageText(markdown, "markdown");
}

function extractText(body: Record<string, unknown>) {
  const text = body.text;
  if (typeof text === "string") {
    return text;
  }

  return collectPageText(text, "text");
}

async function readJson(response: Response) {
  const body = await response.text();
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { rawText: body };
  }
}

async function llamaFetch(path: string, init: RequestInit) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("LLAMA_CLOUD_API_KEY is not configured.");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LlamaCloud request failed with status ${response.status}: ${body.slice(0, 300)}`);
  }

  return readJson(response);
}

async function uploadFile(input: LlamaCloudUploadInput) {
  const formData = new FormData();
  const arrayBuffer = new ArrayBuffer(input.bytes.byteLength);
  new Uint8Array(arrayBuffer).set(input.bytes);

  formData.set("purpose", input.purpose);
  formData.set("file", new Blob([arrayBuffer], { type: input.mimeType }), input.fileName);

  const body = await llamaFetch("/api/v1/beta/files", {
    method: "POST",
    body: formData,
  });

  const fileId = getString(body.id);
  if (!fileId) {
    throw new Error("LlamaCloud file upload did not return a file id.");
  }

  return fileId;
}

async function startParseJob(fileId: string) {
  const body = await llamaFetch("/api/v2/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_id: fileId,
      tier: getParseTier(),
      version: "latest",
      output_options: {
        markdown: {
          tables: {
            output_tables_as_markdown: true,
          },
        },
      },
      processing_options: {
        ocr_parameters: {
          languages: ["en"],
        },
      },
    }),
  });

  const jobId = getString(body.id);
  if (!jobId) {
    throw new Error("LlamaCloud parse job did not return a job id.");
  }

  return jobId;
}

async function getParseJob(jobId: string) {
  const params = new URLSearchParams();
  params.append("expand", "markdown");
  params.append("expand", "text");
  params.append("expand", "items");
  params.append("expand", "metadata");

  const body = await llamaFetch(`/api/v2/parse/${jobId}?${params.toString()}`, {
    method: "GET",
  });

  return {
    status: getStatus(asRecord(body.job).status || body.status),
    body,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasLlamaCloudConfig() {
  return Boolean(getApiKey());
}

export async function parseDocumentWithLlamaCloud(input: LlamaCloudParseInput): Promise<LlamaCloudParseResult> {
  const fileId = await uploadFile({
    ...input,
    purpose: "parse",
  });
  const jobId = await startParseJob(fileId);

  let latest: Awaited<ReturnType<typeof getParseJob>> | null = null;

  for (let attempt = 0; attempt < getPollAttempts(); attempt += 1) {
    latest = await getParseJob(jobId);

    if (latest.status === "COMPLETED") {
      return {
        fileId,
        jobId,
        status: latest.status,
        markdown: extractMarkdown(latest.body),
        text: extractText(latest.body),
        raw: latest.body,
      };
    }

    if (latest.status === "FAILED" || latest.status === "CANCELLED") {
      throw new Error(`LlamaCloud parse job ${jobId} ended with status ${latest.status}.`);
    }

    await delay(getPollIntervalMs());
  }

  throw new Error(`LlamaCloud parse job ${jobId} did not complete before the local polling limit.`);
}
