const defaultBatchSize = 10;
const defaultLivePilotMaxCandidates = 1;

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

function getPipelineMode(env) {
  return env.PIPELINE_MODE || "dry_run";
}

function getLivePilotMaxCandidates(env) {
  const parsed = Number(env.LIVE_PILOT_MAX_CANDIDATES || defaultLivePilotMaxCandidates);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(10, Math.round(parsed)) : defaultLivePilotMaxCandidates;
}

function getRequiredPositiveNumber(env, key) {
  const raw = env[key];
  const parsed = Number(raw);
  return typeof raw === "string" && raw.trim() && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function getLivePilotBudget(env) {
  const maxSearches = getRequiredPositiveNumber(env, "LIVE_PILOT_MAX_SEARCHES");
  const maxEstimatedCostUsd = getRequiredPositiveNumber(env, "LIVE_PILOT_MAX_ESTIMATED_COST_USD");

  return {
    maxSearches: maxSearches === undefined ? undefined : Math.min(5, Math.round(maxSearches)),
    maxEstimatedCostUsd: maxEstimatedCostUsd === undefined ? undefined : Math.min(1, Number(maxEstimatedCostUsd.toFixed(4))),
    configured: maxSearches !== undefined && maxEstimatedCostUsd !== undefined,
  };
}

function getPipelineSafety(env) {
  const mode = getPipelineMode(env);
  const livePilotEnabled = env.LIVE_PILOT_ENABLED === "true";
  const livePilotMaxCandidates = getLivePilotMaxCandidates(env);
  const livePilotBudget = getLivePilotBudget(env);

  return {
    mode,
    dryRunEnrichment: true,
    livePilotEnabled,
    livePilotMaxCandidates,
    livePilotBudget,
    liveEnrichmentEnabled: false,
  };
}

function validateJobSafety(env, sourceCandidates) {
  const safety = getPipelineSafety(env);
  const validModes = new Set(["dry_run", "dry_run_failure_test", "live_pilot"]);

  if (!validModes.has(safety.mode)) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported PIPELINE_MODE '${safety.mode}'.`,
      safety,
    };
  }

  if (safety.mode !== "live_pilot") {
    return { ok: true, safety };
  }

  if (!safety.livePilotEnabled) {
    return {
      ok: false,
      status: 403,
      error: "Live pilot mode is disabled. Set LIVE_PILOT_ENABLED=true before accepting live-pilot jobs.",
      safety,
    };
  }

  if (sourceCandidates.length > safety.livePilotMaxCandidates) {
    return {
      ok: false,
      status: 413,
      error: `Live pilot jobs are capped at ${safety.livePilotMaxCandidates} source candidate(s).`,
      safety,
    };
  }

  if (!safety.livePilotBudget.configured) {
    return {
      ok: false,
      status: 403,
      error: "Live pilot budgets are not configured. Set LIVE_PILOT_MAX_SEARCHES and LIVE_PILOT_MAX_ESTIMATED_COST_USD before accepting live-pilot jobs.",
      safety,
    };
  }

  return { ok: true, safety };
}

function validateQueueSafety(env, payload) {
  if (getPipelineMode(env) !== "live_pilot") {
    return;
  }

  const safety = payload.safety && typeof payload.safety === "object" ? payload.safety : undefined;
  if (
    !safety ||
    safety.mode !== "live_pilot" ||
    safety.livePilotEnabled !== true ||
    !safety.livePilotBudget ||
    safety.livePilotBudget.configured !== true
  ) {
    throw new Error("Live pilot queue payload is missing the admitted safety budget.");
  }
}

function getDryRunBudgetUsage(payload, candidateCount) {
  return {
    mode: payload.safety?.mode || "dry_run",
    dryRun: true,
    candidateCount,
    searchesUsed: 0,
    estimatedCostUsd: 0,
    budget: payload.safety?.livePilotBudget,
  };
}

function shouldSimulateFailure(env, payload) {
  if (getPipelineMode(env) !== "dry_run_failure_test") {
    return false;
  }

  const parsed = Number(env.DRY_RUN_FAIL_BATCH_INDEX || 0);
  const failBatchIndex = Number.isFinite(parsed) ? parsed : 0;
  const retryAttempt = Number(payload.retryAttempt || 0);
  return Number(payload.batchIndex || 0) === failBatchIndex && retryAttempt === 0;
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

async function getJobStatus(env, jobId) {
  const response = await getJobStub(env, jobId).fetch("https://job-status/status");
  if (!response.ok) {
    return null;
  }

  return response.json();
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

function safeCacheSegment(value, fallback) {
  const normalized = typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : fallback;

  return normalized.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || fallback;
}

function getDryRunSourceCacheReference(jobId, batchIndex, candidateIndex, candidate) {
  const fingerprint = safeCacheSegment(candidate.fingerprint, `candidate-${candidateIndex}`);
  const sourceHash = safeCacheSegment(candidate.sourceHash || candidate.sourceUrlHash || candidate.searchQuery, "source-pending");

  return {
    status: "planned",
    dryRun: true,
    objectKey: `dry-run/source-cache/${safeCacheSegment(jobId, "job")}/${fingerprint}/${sourceHash}.json`,
    identityFingerprint: typeof candidate.fingerprint === "string" ? candidate.fingerprint : undefined,
    sourceHash,
    batchIndex,
    note: "Dry-run metadata only. No source PDF or cache object was written.",
  };
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

async function writeBatchCompletedToD1(env, payload, results, budgetUsage) {
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
        JSON.stringify({ results, budgetUsage, safety: payload.safety }),
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
        JSON.stringify({
          batchIndex: payload.batchIndex,
          candidateCount: results.length,
          budgetUsage,
          safety: payload.safety,
        }),
        now,
      ),
    ];

    for (const result of results) {
      const cacheReference = result.sourceCacheReference && typeof result.sourceCacheReference === "object"
        ? result.sourceCacheReference
        : undefined;

      if (!cacheReference?.objectKey) {
        continue;
      }

      statements.push(
        db.prepare(
          `INSERT OR REPLACE INTO source_cache_index (
            cache_key, identity_fingerprint, source_url, source_domain,
            source_file_hash, source_text_hash, r2_object_key, content_type,
            byte_size, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          cacheReference.objectKey,
          cacheReference.identityFingerprint || result.fingerprint || null,
          null,
          null,
          null,
          cacheReference.sourceHash || null,
          cacheReference.objectKey,
          "application/json; charset=utf-8",
          0,
          "planned",
          now,
          now,
        ),
      );

      if (cacheReference.identityFingerprint || result.fingerprint) {
        statements.push(
          db.prepare(
            `INSERT INTO identity_lookup_cache (
              identity_fingerprint, normalized_identity, database_match_status,
              approved_product_id, source_cache_key, confidence, payload_json,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(identity_fingerprint) DO UPDATE SET
              source_cache_key = excluded.source_cache_key,
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at`,
          ).bind(
            cacheReference.identityFingerprint || result.fingerprint,
            result.productName || null,
            "unknown",
            null,
            cacheReference.objectKey,
            null,
            JSON.stringify({ sourceCacheReference: cacheReference, dryRun: true }),
            now,
            now,
          ),
        );
      }
    }

    await db.batch(statements);
  });
}

async function writeBatchFailedToD1(env, payload, errorMessage) {
  const now = new Date().toISOString();
  return runPipelineStateWrite(env, async (db) => {
    await db.batch([
      db.prepare(
        `UPDATE pipeline_jobs
         SET failed_batch_count = MIN(batch_count, failed_batch_count + 1),
             status = CASE
               WHEN completed_batch_count + MIN(batch_count, failed_batch_count + 1) >= batch_count THEN 'failed'
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
        "dry_run_failed",
        errorMessage,
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
        "batch_failed",
        payload.batchIndex,
        errorMessage,
        JSON.stringify({ errorMessage, retryAttempt: payload.retryAttempt || 0 }),
        now,
      ),
    ]);
  });
}

async function writeBatchRetriedToD1(env, jobId, failedBatches) {
  const now = new Date().toISOString();
  return runPipelineStateWrite(env, async (db) => {
    const statements = [
      db.prepare(
        `UPDATE pipeline_jobs
         SET failed_batch_count = MAX(0, failed_batch_count - ?),
             status = ?,
             updated_at = ?
         WHERE job_id = ?`,
      ).bind(failedBatches.length, "queued", now, jobId),
    ];

    for (const batch of failedBatches) {
      statements.push(
        db.prepare(
          `UPDATE source_search_candidates
           SET status = ?, review_reason = ?, updated_at = ?
           WHERE job_id = ? AND batch_index = ?`,
        ).bind(
          "queued",
          "Failed dry-run batch was requeued for retry.",
          now,
          jobId,
          batch.batchIndex,
        ),
      );
      statements.push(
        db.prepare(
          `INSERT INTO pipeline_job_events (
            event_id, job_id, event_type, batch_index, message, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          jobId,
          "batch_retry_queued",
          batch.batchIndex,
          "Failed dry-run batch requeued.",
          JSON.stringify({ retryAttempt: batch.retryAttempt }),
          now,
        ),
      );
    }

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
  const safetyResult = validateJobSafety(env, sourceCandidates);
  if (!safetyResult.ok) {
    return jsonResponse({
      error: safetyResult.error,
      safety: safetyResult.safety,
    }, { status: safetyResult.status });
  }

  const safety = safetyResult.safety;
  const batches = chunkItems(sourceCandidates, getBatchSize(env));
  const status = batches.length ? "queued" : "waiting_for_candidates";

  await getJobStub(env, jobId).fetch("https://job-status/init", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      projectId,
      status,
      safety,
      candidateCount: sourceCandidates.length,
      batchCount: batches.length,
      batches: batches.map((candidates, batchIndex) => ({
        batchIndex,
        candidates,
        candidateCount: candidates.length,
      })),
      createdAt: new Date().toISOString(),
    }),
  });

  const d1State = await writeJobCreatedToD1(env, {
    jobId,
    projectId,
    status,
    safety,
    candidateCount: sourceCandidates.length,
    batchCount: batches.length,
  }, batches);

  for (const [batchIndex, candidates] of batches.entries()) {
    await env.SOURCE_ENRICHMENT_QUEUE.send({
      jobId,
      projectId,
      batchIndex,
      candidates,
      safety,
      retryAttempt: 0,
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
      safety,
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

async function handleRetryFailedBatches(request, env, jobId) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized." }, { status: 401 });
  }

  const job = await getJobStatus(env, jobId);
  if (!job) {
    return jsonResponse({ error: "Job not found." }, { status: 404 });
  }

  const batches = job.batches && typeof job.batches === "object" ? job.batches : {};
  const failedBatches = Object.entries(batches)
    .filter(([, batch]) => batch && typeof batch === "object" && batch.status === "failed")
    .map(([batchIndex, batch]) => ({
      batchIndex: Number(batchIndex),
      candidates: Array.isArray(batch.candidates) ? batch.candidates : [],
      retryAttempt: Number(batch.retryAttempt || 0) + 1,
    }))
    .filter((batch) => Number.isFinite(batch.batchIndex) && batch.candidates.length > 0);

  if (failedBatches.length === 0) {
    return jsonResponse({
      jobId,
      status: "no_failed_batches",
      requeuedBatchCount: 0,
    });
  }

  for (const batch of failedBatches) {
    await env.SOURCE_ENRICHMENT_QUEUE.send({
      jobId,
      projectId: job.projectId,
      batchIndex: batch.batchIndex,
      candidates: batch.candidates,
      safety: job.safety,
      retryAttempt: batch.retryAttempt,
      createdAt: new Date().toISOString(),
    });
  }

  await sendJobUpdate(env, jobId, {
    type: "batch_retry_queued",
    batches: failedBatches.map((batch) => ({
      batchIndex: batch.batchIndex,
      candidateCount: batch.candidates.length,
      retryAttempt: batch.retryAttempt,
    })),
    queuedAt: new Date().toISOString(),
  });
  const d1State = await writeBatchRetriedToD1(env, jobId, failedBatches);

  return jsonResponse({
    jobId,
    status: "retry_queued",
    requeuedBatchCount: failedBatches.length,
    d1State,
  });
}

async function handleQueueMessage(message, env) {
  const payload = message.body || {};
  const jobId = String(payload.jobId || "");

  if (!jobId) {
    return;
  }

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  try {
    validateQueueSafety(env, payload);
    await writeBatchStartedToD1(env, payload, candidates.length);

    await sendJobUpdate(env, jobId, {
      type: "batch_started",
      batchIndex: payload.batchIndex,
      candidateCount: candidates.length,
      retryAttempt: payload.retryAttempt || 0,
      candidates,
      safety: payload.safety,
      startedAt: new Date().toISOString(),
    });

    if (shouldSimulateFailure(env, payload)) {
      throw new Error("Simulated dry-run batch failure.");
    }

    const results = candidates.map((candidate, candidateIndex) => {
      const sourceCacheReference = getDryRunSourceCacheReference(jobId, payload.batchIndex || 0, candidateIndex, candidate);

      return {
        fingerprint: candidate.fingerprint,
        productName: candidate.productName,
        status: "dry_run_not_enriched",
        reviewReason: "Cloudflare pipeline accepted this candidate without calling OpenAI or web search.",
        sourceCacheReference,
      };
    });
    const sourceCacheReferences = results.map((result) => result.sourceCacheReference);
    const budgetUsage = getDryRunBudgetUsage(payload, results.length);

    await writeBatchCompletedToD1(env, payload, results, budgetUsage);

    await sendJobUpdate(env, jobId, {
      type: "batch_completed",
      batchIndex: payload.batchIndex,
      candidateCount: results.length,
      safety: payload.safety,
      budgetUsage,
      sourceCacheReferences,
      results,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Dry-run batch failed.";
    await writeBatchFailedToD1(env, payload, errorMessage);
    await sendJobUpdate(env, jobId, {
      type: "batch_failed",
      batchIndex: payload.batchIndex,
      candidateCount: candidates.length,
      retryAttempt: payload.retryAttempt || 0,
      candidates,
      errorMessage,
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
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
        batches: Array.isArray(job.batches)
          ? Object.fromEntries(job.batches.map((batch) => [
              batch.batchIndex,
              {
                status: "queued",
                candidateCount: batch.candidateCount,
                candidates: Array.isArray(batch.candidates) ? batch.candidates : [],
                retryAttempt: 0,
              },
            ]))
          : {},
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
          ...batches[update.batchIndex],
          status: "processing",
          candidateCount: update.candidateCount,
          candidates: Array.isArray(update.candidates)
            ? update.candidates
            : batches[update.batchIndex]?.candidates || [],
          safety: update.safety || batches[update.batchIndex]?.safety,
          retryAttempt: update.retryAttempt || batches[update.batchIndex]?.retryAttempt || 0,
          startedAt: update.startedAt,
        };
      }

      if (update.type === "batch_completed") {
        const budgetUsage = update.budgetUsage && typeof update.budgetUsage === "object"
          ? update.budgetUsage
          : {
              searchesUsed: 0,
              estimatedCostUsd: 0,
              dryRun: true,
            };
        batches[update.batchIndex] = {
          ...batches[update.batchIndex],
          status: "completed",
          candidateCount: update.candidateCount,
          safety: update.safety || batches[update.batchIndex]?.safety,
          budgetUsage,
          sourceCacheReferences: Array.isArray(update.sourceCacheReferences) ? update.sourceCacheReferences : [],
          completedAt: update.completedAt,
        };
        results.push(...(Array.isArray(update.results) ? update.results : []));
        job.sourceCacheReferences = [
          ...(Array.isArray(job.sourceCacheReferences) ? job.sourceCacheReferences : []),
          ...(Array.isArray(update.sourceCacheReferences) ? update.sourceCacheReferences : []),
        ];
        job.completedBatchCount = (job.completedBatchCount || 0) + 1;
        job.budgetUsage = {
          searchesUsed: (job.budgetUsage?.searchesUsed || 0) + (budgetUsage.searchesUsed || 0),
          estimatedCostUsd: Number(((job.budgetUsage?.estimatedCostUsd || 0) + (budgetUsage.estimatedCostUsd || 0)).toFixed(4)),
          dryRun: budgetUsage.dryRun !== false,
        };
      }

      if (update.type === "batch_failed") {
        batches[update.batchIndex] = {
          ...batches[update.batchIndex],
          status: "failed",
          candidateCount: update.candidateCount,
          candidates: Array.isArray(update.candidates)
            ? update.candidates
            : batches[update.batchIndex]?.candidates || [],
          retryAttempt: update.retryAttempt || batches[update.batchIndex]?.retryAttempt || 0,
          errorMessage: update.errorMessage,
          failedAt: update.failedAt,
        };
        job.failedBatchCount = (job.failedBatchCount || 0) + 1;
      }

      if (update.type === "batch_retry_queued") {
        const retryBatches = Array.isArray(update.batches) ? update.batches : [];
        for (const batch of retryBatches) {
          batches[batch.batchIndex] = {
            ...batches[batch.batchIndex],
            status: "queued",
            retryAttempt: batch.retryAttempt,
            candidateCount: batch.candidateCount,
            requeuedAt: update.queuedAt,
          };
        }
        job.failedBatchCount = Math.max(0, (job.failedBatchCount || 0) - retryBatches.length);
      }

      const batchCount = job.batchCount || 0;
      const completedBatchCount = job.completedBatchCount || 0;
      const failedBatchCount = job.failedBatchCount || 0;
      const status = failedBatchCount > 0
        ? "failed"
        : batchCount > 0 && completedBatchCount >= batchCount
          ? "completed"
          : "processing";

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
        safety: getPipelineSafety(env),
        d1Configured: hasPipelineDb(env),
      });
    }

    if (request.method === "POST" && url.pathname === "/jobs") {
      return handleCreateJob(request, env);
    }

    const retryMatch = url.pathname.match(/^\/jobs\/([^/]+)\/retry-failed$/);
    if (request.method === "POST" && retryMatch) {
      return handleRetryFailedBatches(request, env, decodeURIComponent(retryMatch[1]));
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
