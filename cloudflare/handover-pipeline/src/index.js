const defaultBatchSize = 10;

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function getBatchSize(env) {
  const parsed = Number(env.BATCH_SIZE || defaultBatchSize);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(25, Math.round(parsed)) : defaultBatchSize;
}

function chunkItems(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getJobStub(env, jobId) {
  return env.JOB_STATUS.get(env.JOB_STATUS.idFromName(jobId));
}

function isAuthorized(request, env) {
  if (!env.PIPELINE_SHARED_SECRET) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${env.PIPELINE_SHARED_SECRET}`;
}

async function sendJobUpdate(env, jobId, update) {
  const stub = getJobStub(env, jobId);
  return stub.fetch("https://job-status/update", {
    method: "POST",
    body: JSON.stringify(update),
  });
}

async function handleCreateJob(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const jobId = String(body.jobId || crypto.randomUUID());
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const sourceCandidates = Array.isArray(body.sourceCandidates) ? body.sourceCandidates.slice(0, 250) : [];
  const batches = chunkItems(sourceCandidates, getBatchSize(env));

  await getJobStub(env, jobId).fetch("https://job-status/init", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      projectId,
      status: batches.length ? "queued" : "waiting_for_candidates",
      candidateCount: sourceCandidates.length,
      batchCount: batches.length,
      createdAt: new Date().toISOString(),
    }),
  });

  for (const [batchIndex, candidates] of batches.entries()) {
    await env.SOURCE_ENRICHMENT_QUEUE.send({
      jobId,
      projectId,
      batchIndex,
      candidates,
      createdAt: new Date().toISOString(),
    });
  }

  return jsonResponse(
    {
      jobId,
      status: batches.length ? "queued" : "waiting_for_candidates",
      candidateCount: sourceCandidates.length,
      batchCount: batches.length,
      dryRunEnrichment: true,
      statusUrl: `/jobs/${encodeURIComponent(jobId)}`,
    },
    { status: 202 },
  );
}

async function handleGetJob(request, env, jobId) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized." }, { status: 401 });
  }

  const response = await getJobStub(env, jobId).fetch("https://job-status/status");
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleQueueMessage(message, env) {
  const payload = message.body || {};
  const jobId = String(payload.jobId || "");

  if (!jobId) {
    return;
  }

  await sendJobUpdate(env, jobId, {
    type: "batch_started",
    batchIndex: payload.batchIndex,
    candidateCount: Array.isArray(payload.candidates) ? payload.candidates.length : 0,
    startedAt: new Date().toISOString(),
  });

  const results = (Array.isArray(payload.candidates) ? payload.candidates : []).map((candidate) => ({
    fingerprint: candidate.fingerprint,
    productName: candidate.productName,
    status: "dry_run_not_enriched",
    reviewReason: "Cloudflare pipeline accepted this candidate without calling OpenAI or web search.",
  }));

  await sendJobUpdate(env, jobId, {
    type: "batch_completed",
    batchIndex: payload.batchIndex,
    candidateCount: results.length,
    results,
    completedAt: new Date().toISOString(),
  });
}

export class HandoverPipelineJob {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/init") {
      const job = await request.json();
      await this.state.storage.put("job", {
        ...job,
        completedBatchCount: 0,
        failedBatchCount: 0,
        batches: {},
        results: [],
        updatedAt: new Date().toISOString(),
      });
      return jsonResponse({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/update") {
      const update = await request.json();
      const job = (await this.state.storage.get("job")) || {
        status: "unknown",
        batches: {},
        results: [],
      };
      const batches = job.batches || {};
      const results = Array.isArray(job.results) ? job.results : [];

      if (update.type === "batch_started") {
        batches[update.batchIndex] = {
          status: "processing",
          candidateCount: update.candidateCount,
          startedAt: update.startedAt,
        };
      }

      if (update.type === "batch_completed") {
        batches[update.batchIndex] = {
          ...batches[update.batchIndex],
          status: "completed",
          candidateCount: update.candidateCount,
          completedAt: update.completedAt,
        };
        results.push(...(Array.isArray(update.results) ? update.results : []));
        job.completedBatchCount = (job.completedBatchCount || 0) + 1;
      }

      const batchCount = job.batchCount || 0;
      const completedBatchCount = job.completedBatchCount || 0;
      const failedBatchCount = job.failedBatchCount || 0;
      const status = batchCount > 0 && completedBatchCount + failedBatchCount >= batchCount ? "completed" : "processing";

      await this.state.storage.put("job", {
        ...job,
        status,
        batches,
        results,
        updatedAt: new Date().toISOString(),
      });
      return jsonResponse({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/status") {
      const job = await this.state.storage.get("job");
      return job ? jsonResponse(job) : jsonResponse({ error: "Job not found." }, { status: 404 });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "builder-handover-pipeline",
        dryRunEnrichment: true,
      });
    }

    if (request.method === "POST" && url.pathname === "/jobs") {
      return handleCreateJob(request, env);
    }

    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (request.method === "GET" && jobMatch) {
      return handleGetJob(request, env, decodeURIComponent(jobMatch[1]));
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      await handleQueueMessage(message, env);
      message.ack();
    }
  },
};

export default worker;
