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

class D1Mock {
  constructor() {
    this.statements = [];
  }

  prepare(sql) {
    return {
      bind: (...params) => ({
        sql,
        params,
      }),
    };
  }

  async batch(statements) {
    this.statements.push(...statements);
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

function countStatements(db, tableOrEvent, predicate = () => true) {
  return db.statements.filter((statement) =>
    statement.sql.includes(tableOrEvent) && predicate(statement),
  ).length;
}

function countCandidateInserts(db) {
  return db.statements.filter((statement) =>
    statement.sql.includes("INSERT OR REPLACE INTO source_search_candidates"),
  ).length;
}

async function main() {
  const { default: worker, HandoverPipelineJob } = await loadWorkerModule();
  const queue = new QueueMock();
  const pipelineDb = new D1Mock();
  const env = {
    BATCH_SIZE: "2",
    PIPELINE_MODE: "dry_run",
    JOB_STATUS: new JobStatusNamespace(HandoverPipelineJob),
    SOURCE_ENRICHMENT_QUEUE: queue,
    PIPELINE_DB: pipelineDb,
  };
  const jobId = `local-d1-dry-run-${Date.now()}`;
  const sourceCandidates = [
    {
      fingerprint: "d1-dry-run-001",
      productName: "D1 Dry Run Product One",
      category: "Dry run",
      searchQuery: "D1 Dry Run Product One warranty",
    },
    {
      fingerprint: "d1-dry-run-002",
      productName: "D1 Dry Run Product Two",
      category: "Dry run",
      sourceHash: "known-source-hash",
    },
  ];

  const createResponse = await worker.fetch(new Request("https://worker.test/jobs", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      projectId: "local-d1-dry-run-project",
      sourceCandidates,
    }),
  }), env);
  const created = await readJson(createResponse);
  assert(created.status === "queued", "Expected D1 dry-run job to be queued.");
  assert(created.d1State?.ok === true && created.d1State.skipped === false, "Expected job creation to write to D1.");
  assert(queue.messages.length === 1, "Expected one queue message.");
  assert(countStatements(pipelineDb, "pipeline_jobs") >= 1, "Expected pipeline job upsert.");
  assert(countStatements(pipelineDb, "pipeline_job_events", (statement) => statement.params.includes("job_created")) >= 1, "Expected job_created event.");
  assert(countCandidateInserts(pipelineDb) === sourceCandidates.length, "Expected one candidate row per source candidate.");

  await worker.queue(queue.takeBatch(), env);

  const completed = await readJson(await worker.fetch(new Request(`https://worker.test/jobs/${jobId}`), env));
  assert(completed.status === "completed", "Expected dry-run job to complete.");
  assert(completed.results?.length === sourceCandidates.length, "Expected dry-run result for each source candidate.");
  assert(completed.budgetUsage?.searchesUsed === 0, "Expected zero searches in dry-run D1 smoke.");
  assert(completed.budgetUsage?.estimatedCostUsd === 0, "Expected zero estimated cost in dry-run D1 smoke.");
  assert(completed.sourceCacheReferences?.length === sourceCandidates.length, "Expected planned cache reference for each candidate.");
  assert(queue.acked.length === 1, "Expected the queue batch to be acked.");
  assert(countStatements(pipelineDb, "pipeline_job_events", (statement) => statement.params.includes("batch_started")) >= 1, "Expected batch_started event.");
  assert(countStatements(pipelineDb, "pipeline_job_events", (statement) => statement.params.includes("batch_completed")) >= 1, "Expected batch_completed event.");
  assert(countStatements(pipelineDb, "cost_meter_events") >= 1, "Expected zero-cost dry-run meter event.");
  assert(countStatements(pipelineDb, "source_cache_index") === sourceCandidates.length, "Expected planned cache index row per candidate.");
  assert(countStatements(pipelineDb, "identity_lookup_cache") === sourceCandidates.length, "Expected identity cache row per candidate.");

  const plannedStatuses = pipelineDb.statements
    .filter((statement) => statement.sql.includes("source_cache_index"))
    .map((statement) => statement.params[9]);
  assert(plannedStatuses.every((status) => status === "planned"), "Expected all source cache index rows to be planned.");

  console.log(JSON.stringify({
    ok: true,
    jobId,
    finalStatus: completed.status,
    candidateRows: countCandidateInserts(pipelineDb),
    jobEvents: countStatements(pipelineDb, "pipeline_job_events"),
    costMeterEvents: countStatements(pipelineDb, "cost_meter_events"),
    plannedCacheRows: countStatements(pipelineDb, "source_cache_index"),
    identityCacheRows: countStatements(pipelineDb, "identity_lookup_cache"),
    budgetUsage: completed.budgetUsage,
    dryRunOnly: true,
    remoteBindingsUsed: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
