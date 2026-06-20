import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

class MemoryStorage {
  constructor() {
    this.records = new Map();
  }

  async get(key) {
    return this.records.get(key);
  }

  async put(key, value) {
    this.records.set(key, value);
  }
}

class JobStatusNamespace {
  constructor(JobClass) {
    this.JobClass = JobClass;
    this.instances = new Map();
  }

  idFromName(name) {
    return String(name);
  }

  get(id) {
    if (!this.instances.has(id)) {
      this.instances.set(id, new this.JobClass({ storage: new MemoryStorage() }));
    }

    const instance = this.instances.get(id);
    return {
      fetch: (input, init) => instance.fetch(input instanceof Request ? input : new Request(input, init)),
    };
  }
}

class QueueMock {
  constructor() {
    this.messages = [];
    this.acked = [];
  }

  async send(body) {
    this.messages.push(body);
  }

  takeBatch() {
    const bodies = this.messages.splice(0, this.messages.length);
    return {
      messages: bodies.map((body) => ({
        body,
        ack: () => this.acked.push(body),
      })),
    };
  }
}

async function loadWorkerModule() {
  const sourcePath = resolve("cloudflare/handover-pipeline/src/index.js");
  const source = await readFile(sourcePath, "utf8");
  const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
  return import(dataUrl);
}

async function readJson(response) {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const { default: worker, HandoverPipelineJob } = await loadWorkerModule();
  const queue = new QueueMock();
  const env = {
    BATCH_SIZE: "10",
    PIPELINE_MODE: "dry_run_failure_test",
    DRY_RUN_FAIL_BATCH_INDEX: "0",
    JOB_STATUS: new JobStatusNamespace(HandoverPipelineJob),
    SOURCE_ENRICHMENT_QUEUE: queue,
  };
  const jobId = `local-retry-smoke-${Date.now()}`;
  const sourceCandidates = [
    {
      fingerprint: "retry-smoke-001",
      productName: "Retry Smoke Product One",
      category: "Dry run",
    },
    {
      fingerprint: "retry-smoke-002",
      productName: "Retry Smoke Product Two",
      category: "Dry run",
    },
  ];

  const createResponse = await worker.fetch(new Request("https://worker.test/jobs", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      projectId: "local-retry-smoke-project",
      sourceCandidates,
    }),
  }), env);
  const created = await readJson(createResponse);
  assert(created.status === "queued", "Expected created job to be queued.");
  assert(created.safety?.mode === "dry_run_failure_test", "Expected dry-run failure-test safety metadata.");
  assert(created.batchCount === 1, "Expected one queued batch.");
  assert(queue.messages.length === 1, "Expected one queued message.");
  assert(queue.messages[0].safety?.mode === "dry_run_failure_test", "Expected queue message to carry safety metadata.");

  try {
    await worker.queue(queue.takeBatch(), env);
    throw new Error("Expected first dry-run batch processing to fail.");
  } catch (error) {
    assert(
      error instanceof Error && error.message === "Simulated dry-run batch failure.",
      "Expected simulated failure error.",
    );
  }

  const failed = await readJson(await worker.fetch(new Request(`https://worker.test/jobs/${jobId}`), env));
  assert(failed.status === "failed", "Expected job status to be failed after simulated batch failure.");
  assert(failed.failedBatchCount === 1, "Expected one failed batch.");
  assert(failed.batches?.[0]?.status === "failed", "Expected batch 0 to be failed.");
  assert(failed.safety?.mode === "dry_run_failure_test", "Expected job status to retain safety metadata.");
  assert(failed.batches?.[0]?.candidates?.length === 2, "Expected failed batch to retain candidate payloads.");

  const retry = await readJson(await worker.fetch(new Request(`https://worker.test/jobs/${jobId}/retry-failed`, {
    method: "POST",
  }), env));
  assert(retry.status === "retry_queued", "Expected failed batch retry to be queued.");
  assert(retry.requeuedBatchCount === 1, "Expected one failed batch to be requeued.");
  assert(queue.messages.length === 1, "Expected retry to enqueue one message.");
  assert(queue.messages[0].retryAttempt === 1, "Expected retry attempt to increment.");
  assert(queue.messages[0].safety?.mode === "dry_run_failure_test", "Expected retry queue message to retain safety metadata.");

  const requeued = await readJson(await worker.fetch(new Request(`https://worker.test/jobs/${jobId}`), env));
  assert(requeued.failedBatchCount === 0, "Expected failed batch count to clear after retry queueing.");
  assert(requeued.batches?.[0]?.status === "queued", "Expected batch 0 to return to queued.");

  await worker.queue(queue.takeBatch(), env);

  const completed = await readJson(await worker.fetch(new Request(`https://worker.test/jobs/${jobId}`), env));
  assert(completed.status === "completed", "Expected retry batch to complete.");
  assert(completed.completedBatchCount === 1, "Expected completed batch count to be one.");
  assert(completed.failedBatchCount === 0, "Expected no failed batches after retry completion.");
  assert(completed.results?.length === 2, "Expected dry-run results for both candidates.");
  assert(completed.sourceCacheReferences?.length === 2, "Expected planned source cache references for both candidates.");
  assert(
    completed.sourceCacheReferences[0].objectKey.startsWith("dry-run/source-cache/"),
    "Expected source cache key to use the dry-run source-cache prefix.",
  );
  assert(completed.sourceCacheReferences[0].dryRun === true, "Expected source cache reference to be dry-run only.");
  assert(completed.budgetUsage?.searchesUsed === 0, "Expected dry-run retry completion to record zero searches.");
  assert(completed.budgetUsage?.estimatedCostUsd === 0, "Expected dry-run retry completion to record zero cost.");

  console.log(JSON.stringify({
    ok: true,
    jobId,
    firstFailureStatus: failed.status,
    retryStatus: retry.status,
    finalStatus: completed.status,
    resultCount: completed.results.length,
    sourceCacheReferenceCount: completed.sourceCacheReferences.length,
    firstSourceCacheKey: completed.sourceCacheReferences[0].objectKey,
    budgetUsage: completed.budgetUsage,
    dryRunOnly: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
