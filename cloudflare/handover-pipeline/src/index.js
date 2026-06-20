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

function hasPipelineDb(env) {
  return Boolean(env.PIPELINE_DB && typeof env.PIPELINE_DB.prepare === "function");
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

async function runPipelineStateWrite(env, operation) {
  if (!hasPipelineDb(env)) {
    return { ok: true, skipped: true, reason: "PIPELINE_DB binding is not configured." };
  }

  try {
    await operation(env.PIPELINE_DB);
    return { ok: true, skipped: false };
  } catch (error) {
    console.error("D1 pipeline state write failed", error);
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Unknown D1 error.",
    };
  }
}

function candidateIdFor(jobId, batchIndex, candidateIndex, candidate) {
  const fingerprint = typeof candidate.fingerprint === "string" && candidate.fingerprint
    ? candidate.fingerprint
    : `candidate-${candidateIndex}`;
  return `${jobId}:${batchIndex}:${fingerprint}`.replace(/[^a-zA-Z0-9:._-]/g, "-").slice(0, 240);
}

async function writeJobCreatedToD1(env, job, batches) {
  const now = new Date().toISOString();
  return runPipelineStateWrite(env, async (db) => {
    const statements = [
      db.prepare(
        `INSERT INTO pipeline_jobs (
          job_id, project_id, status, pipeline_mode, dry_run, candidate_count,
          batch_count, completed_batch_count, failed_batch_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
          project_id = excluded.project_id,
          status = excluded.status,
          pipeline_mode = excluded.pipeline_mode,
          dry_run = excluded.dry_run,
          candidate_count = excluded.candidate_count,
          batch_count = excluded.batch_count,
          updated_at = excluded.updated_at`,
      ).bind(
        job.jobId,
        job.projectId || null,
        job.status,
        env.PIPELINE_MODE || "dry_run",
        1,
        job.candidateCount,
        job.batchCount,
        now,
        now,
      ),
      db.prepare(
        `INSERT INTO pipeline_job_events (
          event_id, job_id, event_type, batch_index, message, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        job.jobId,
        "job_created",
        null,
        "Dry-run pipeline job accepted.",
        JSON.stringify(job),
        now,
      ),
    ];

    for (const [batchIndex, candidates] of batches.entries()) {
      for (const [candidateIndex, candidate] of candidates.entries()) {
        statements.push(
          db.prepare(
            `INSERT OR REPLACE INTO source_search_candidates (
              candidate_id, job_id, batch_index, identity_fingerprint, product_name,
              category, search_query, status, review_reason, payload_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            candidateIdFor(job.jobId, batchIndex, candidateIndex, candidate),
            job.jobId,
            batchIndex,
            candidate.fingerprint || null,
            candidate.productName || null,
            candidate.category || null,
            candidate.searchQuery || null,
            "queued",
            "Queued for Cloudflare dry-run only; no OpenAI or web search will run.",
            JSON.stringify(candidate),
            now,
            now,
          ),
        );
      }
    }

    await db.batch(statements);
  });
}

async function writeBatchStartedToD1(env, payload, candidateCount) {
  const now = new Date().toISOString();
  return runPipelineStateWrite(env, async (db) => {
    await db.batch([
      db.prepare(
        `UPDATE source_search_candidates
         SET status = ?, updated_at = ?
         WHERE job_id = ? AND batch_index = ?`,
      ).bind("processing", now, payload.jobId, payload.batchIndex),
      db.prepare(
        `INSERT INTO pipeline_job_events (
          event_id, job_id, event_type, batch_index, message, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        payload.jobId,
        "batch_started",
        payload.batchIndex,
        `Dry-run batch started with ${candidateCount} candidates.`,
        JSON.stringify({ candidateCount }),
        now,
      ),
    ]);
  });
}

async function writeBatchCompletedToD1(env, payload, results) {
  const now = new Date().toISOString();
  return runPipelineStateWrite(env, async (db) => {
    const statements = [
      db.prepare(
        `UPDATE pipeline_jobs
         SET completed_batch_count = completed_batch_count + 1,
             status = CASE
               WHEN completed_batch_count + 1 + failed_batch_count >= batch_count THEN 'completed'
               ELSE 'processing'
             END,
             updated_at = ?
         WHERE job_id = ?`,
      ).bind(now, payload.jobId),
      db.prepare(
        `UPDATE source_search_candidates
         SET status = ?, review_reason = ?, updated_at = ?
         WHERE job_id = ? AND batch_index = ?`,
      ).bind(
        "dry_run_not_enriched",
        "Cloudflare pipeline accepted this candidate without calling OpenAI or web search.",
        now,
        payload.jobId,
        payload.batchIndex,
      ),
      db.prepare(
        `INSERT INTO pipeline_job_events (
          event_id, job_id, event_type, batch_index, message, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        payload.jobId,
        "batch_completed",
        payload.batchIndex,
        `Dry-run batch completed with ${results.length} candidates.`,
        JSON.stringify({ results }),
        now,
      ),
      db.prepare(
        `INSERT INTO cost_meter_events (
          event_id, job_id, candidate_id, event_type, provider, model, input_units,
          output_units, search_count, estimated_cost_usd, dry_run, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 1, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        payload.jobId,
        null,
        "dry_run_batch_completed",
        "cloudflare-worker",
        null,
        JSON.stringify({ batchIndex: payload.batchIndex, candidateCount: results.length }),
        now,
      ),
    ];

    await db.batch(statements);
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
  const status = batches.length ? "queued" : "waiting_for_candidates";

  await getJobStub(env, jobId).fetch("https://job-status/init", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      projectId,
      status,
      candidateCount: sourceCandidates.length,
      batchCount: batches.length,
      createdAt: new Date().toISOString(),
    }),
  });

  const d1State = await writeJobCreatedToD1(env, {
    jobId,
    projectId,
    status,
    candidateCount: sourceCandidates.length,
    batchCount: batches.length,
  }, batches);

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
      d1State,
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

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  await writeBatchStartedToD1(env, payload, candidates.length);

  await sendJobUpdate(env, jobId, {
    type: "batch_started",
    batchIndex: payload.batchIndex,
    candidateCount: candidates.length,
    startedAt: new Date().toISOString(),
  });

  const results = candidates.map((candidate) => ({
    fingerprint: candidate.fingerprint,
    productName: candidate.productName,
    status: "dry_run_not_enriched",
    reviewReason: "Cloudflare pipeline accepted this candidate without calling OpenAI or web search.",
  }));

  await writeBatchCompletedToD1(env, payload, results);

  await sendJobUpdate(env, jobId, {
    type: "batch_completed",
    batchIndex: payload.batchIndex,
    candidateCount: results.length,
    results,
    completedAt: new Date().toISOString(),
  });
}

async function handleCacheSmoke(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized." }, { status: 401 });
  }

  if (!env.SOURCE_PDF_BUCKET) {
    return jsonResponse({ error: "SOURCE_PDF_BUCKET binding is not configured." }, { status: 500 });
  }

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const requestedJobId = typeof body.jobId === "string" && body.jobId.trim()
    ? body.jobId.trim()
    : `smoke-${crypto.randomUUID()}`;
  const safeJobId = requestedJobId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const key = `dry-run/smoke/${safeJobId}.json`;
  const payload = {
    jobId: safeJobId,
    kind: "r2_synthetic_smoke",
    dryRunEnrichment: true,
    note: "Synthetic metadata only. No third-party PDFs or source documents were fetched.",
    createdAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload, null, 2);

  await env.SOURCE_PDF_BUCKET.put(key, serialized, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
    customMetadata: {
      dryRun: "true",
      source: "builder-handover-pipeline",
    },
  });

  const object = await env.SOURCE_PDF_BUCKET.get(key);

  return jsonResponse({
    ok: Boolean(object),
    key,
    byteSize: serialized.length,
    uploaded: Boolean(object),
    dryRunOnly: true,
    note: "Wrangler local mode stores this in local simulated R2. Calling this on a deployed Worker writes one tiny synthetic JSON object to the bound R2 bucket.",
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
        d1Configured: hasPipelineDb(env),
      });
    }

    if (request.method === "POST" && url.pathname === "/jobs") {
      return handleCreateJob(request, env);
    }

    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/cache/smoke") {
      return handleCacheSmoke(request, env);
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
