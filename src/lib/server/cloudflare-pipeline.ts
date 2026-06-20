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

type CreatePipelineJobResponse = {
  jobId?: unknown;
  candidateCount?: unknown;
  batchCount?: unknown;
  statusUrl?: unknown;
  dryRunEnrichment?: unknown;
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
