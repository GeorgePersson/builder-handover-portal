import type { SourceEnrichmentCandidate } from "@/lib/server/source-enrichment-cost";

export type CloudflarePipelineDispatchResult =
  | {
      status: "skipped";
      reason: "not_configured" | "no_source_candidates";
      candidateCount: number;
    }
  | {
      status: "queued";
      jobId: string;
      candidateCount: number;
      batchCount?: number;
      statusUrl?: string;
      dryRunEnrichment: true;
      workerUrl: string;
      dispatchedAt: string;
    }
  | {
      status: "failed";
      candidateCount: number;
      error: string;
      workerUrl?: string;
      dispatchedAt: string;
    };

export type CloudflarePipelineJobStatus = {
  status: "synced" | "failed";
  jobId: string;
  workerStatus?: string;
  candidateCount?: number;
  batchCount?: number;
  completedBatchCount?: number;
  failedBatchCount?: number;
  resultsCount?: number;
  budgetUsage?: CloudflarePipelineBudgetUsage;
  sourceCacheReferences?: CloudflarePipelineSourceCacheReference[];
  updatedAt?: string;
  syncedAt: string;
  workerUrl?: string;
  error?: string;
};

export type CloudflarePipelineBudgetUsage = {
  searchesUsed?: number;
  estimatedCostUsd?: number;
  dryRun?: boolean;
};

export type CloudflarePipelineSourceCacheReference = {
  status?: string;
  objectKey?: string;
  dryRun?: boolean;
  identityFingerprint?: string;
  sourceHash?: string;
};

export type CloudflarePipelineRetryResult = {
  status: "retry_queued" | "no_failed_batches" | "failed";
  jobId: string;
  requeuedBatchCount: number;
  retriedAt: string;
  workerUrl?: string;
  error?: string;
};

type CreatePipelineJobResponse = {
  jobId?: unknown;
  candidateCount?: unknown;
  batchCount?: unknown;
  statusUrl?: unknown;
  dryRunEnrichment?: unknown;
};

type PipelineJobStatusResponse = {
  status?: unknown;
  candidateCount?: unknown;
  batchCount?: unknown;
  completedBatchCount?: unknown;
  failedBatchCount?: unknown;
  results?: unknown;
  budgetUsage?: unknown;
  sourceCacheReferences?: unknown;
  updatedAt?: unknown;
};

type PipelineRetryResponse = {
  status?: unknown;
  jobId?: unknown;
  requeuedBatchCount?: unknown;
};

function getPipelineBaseUrl() {
  return (process.env.CLOUDFLARE_PIPELINE_URL || "").trim().replace(/\/$/, "");
}

function getPipelineSecret() {
  return (process.env.CLOUDFLARE_PIPELINE_SHARED_SECRET || "").trim();
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBudgetUsage(value: unknown): CloudflarePipelineBudgetUsage | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const budgetUsage = value as Record<string, unknown>;

  return {
    searchesUsed: getNumber(budgetUsage.searchesUsed),
    estimatedCostUsd: getNumber(budgetUsage.estimatedCostUsd),
    dryRun: typeof budgetUsage.dryRun === "boolean" ? budgetUsage.dryRun : undefined,
  };
}

function getSourceCacheReferences(value: unknown): CloudflarePipelineSourceCacheReference[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const references = value.reduce<CloudflarePipelineSourceCacheReference[]>((items, item) => {
    if (!item || typeof item !== "object") {
      return items;
    }

    const reference = item as Record<string, unknown>;
    const objectKey = typeof reference.objectKey === "string" ? reference.objectKey : undefined;

    if (!objectKey) {
      return items;
    }

    items.push({
      status: typeof reference.status === "string" ? reference.status : undefined,
      objectKey,
      dryRun: typeof reference.dryRun === "boolean" ? reference.dryRun : undefined,
      identityFingerprint: typeof reference.identityFingerprint === "string" ? reference.identityFingerprint : undefined,
      sourceHash: typeof reference.sourceHash === "string" ? reference.sourceHash : undefined,
    });

    return items;
  }, []);

  return references.length ? references : undefined;
}

export async function dispatchDryRunSourceEnrichmentJob(input: {
  projectId: string;
  extractionJobId: string;
  sourceCandidates: SourceEnrichmentCandidate[];
}): Promise<CloudflarePipelineDispatchResult> {
  const workerUrl = getPipelineBaseUrl();

  if (input.sourceCandidates.length === 0) {
    return {
      status: "skipped",
      reason: "no_source_candidates",
      candidateCount: 0,
    };
  }

  if (!workerUrl) {
    return {
      status: "skipped",
      reason: "not_configured",
      candidateCount: input.sourceCandidates.length,
    };
  }

  const dispatchedAt = new Date().toISOString();

  try {
    const secret = getPipelineSecret();
    const response = await fetch(`${workerUrl}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        jobId: input.extractionJobId,
        projectId: input.projectId,
        sourceCandidates: input.sourceCandidates,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare pipeline returned ${response.status}.`);
    }

    const body = (await response.json()) as CreatePipelineJobResponse;
    const jobId = typeof body.jobId === "string" ? body.jobId : input.extractionJobId;

    return {
      status: "queued",
      jobId,
      candidateCount: getNumber(body.candidateCount) || input.sourceCandidates.length,
      batchCount: getNumber(body.batchCount),
      statusUrl: typeof body.statusUrl === "string" ? body.statusUrl : undefined,
      dryRunEnrichment: true,
      workerUrl,
      dispatchedAt,
    };
  } catch (error) {
    return {
      status: "failed",
      candidateCount: input.sourceCandidates.length,
      error: error instanceof Error ? error.message : "Cloudflare pipeline dispatch failed.",
      workerUrl,
      dispatchedAt,
    };
  }
}

export async function fetchCloudflarePipelineJobStatus(input: {
  jobId: string;
  workerUrl?: string;
  statusUrl?: string;
}): Promise<CloudflarePipelineJobStatus> {
  const workerUrl = (input.workerUrl || getPipelineBaseUrl()).trim().replace(/\/$/, "");
  const syncedAt = new Date().toISOString();

  if (!workerUrl) {
    return {
      status: "failed",
      jobId: input.jobId,
      error: "Cloudflare pipeline URL is not configured.",
      syncedAt,
    };
  }

  try {
    const secret = getPipelineSecret();
    const statusPath = input.statusUrl || `/jobs/${encodeURIComponent(input.jobId)}`;
    const response = await fetch(`${workerUrl}${statusPath}`, {
      method: "GET",
      headers: {
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudflare pipeline returned ${response.status}.`);
    }

    const body = (await response.json()) as PipelineJobStatusResponse;
    return {
      status: "synced",
      jobId: input.jobId,
      workerStatus: typeof body.status === "string" ? body.status : undefined,
      candidateCount: getNumber(body.candidateCount),
      batchCount: getNumber(body.batchCount),
      completedBatchCount: getNumber(body.completedBatchCount),
      failedBatchCount: getNumber(body.failedBatchCount),
      resultsCount: Array.isArray(body.results) ? body.results.length : undefined,
      budgetUsage: getBudgetUsage(body.budgetUsage),
      sourceCacheReferences: getSourceCacheReferences(body.sourceCacheReferences),
      updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : undefined,
      syncedAt,
      workerUrl,
    };
  } catch (error) {
    return {
      status: "failed",
      jobId: input.jobId,
      workerUrl,
      error: error instanceof Error ? error.message : "Cloudflare pipeline status sync failed.",
      syncedAt,
    };
  }
}

export async function retryCloudflarePipelineFailedBatches(input: {
  jobId: string;
  workerUrl?: string;
}): Promise<CloudflarePipelineRetryResult> {
  const workerUrl = (input.workerUrl || getPipelineBaseUrl()).trim().replace(/\/$/, "");
  const retriedAt = new Date().toISOString();

  if (!workerUrl) {
    return {
      status: "failed",
      jobId: input.jobId,
      requeuedBatchCount: 0,
      error: "Cloudflare pipeline URL is not configured.",
      retriedAt,
    };
  }

  try {
    const secret = getPipelineSecret();
    const response = await fetch(`${workerUrl}/jobs/${encodeURIComponent(input.jobId)}/retry-failed`, {
      method: "POST",
      headers: {
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudflare pipeline returned ${response.status}.`);
    }

    const body = (await response.json()) as PipelineRetryResponse;
    const status = body.status === "retry_queued" || body.status === "no_failed_batches"
      ? body.status
      : "failed";

    return {
      status,
      jobId: typeof body.jobId === "string" ? body.jobId : input.jobId,
      requeuedBatchCount: getNumber(body.requeuedBatchCount) || 0,
      retriedAt,
      workerUrl,
    };
  } catch (error) {
    return {
      status: "failed",
      jobId: input.jobId,
      requeuedBatchCount: 0,
      workerUrl,
      error: error instanceof Error ? error.message : "Cloudflare pipeline retry failed.",
      retriedAt,
    };
  }
}
