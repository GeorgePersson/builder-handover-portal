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
  }

  async send(body) {
    this.messages.push(body);
  }
}

async function loadWorkerModule() {
  const sourcePath = resolve("cloudflare/handover-pipeline/src/index.js");
  const source = await readFile(sourcePath, "utf8");
  const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
  return import(dataUrl);
}

async function readJson(response) {
  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createCandidate(index) {
  return {
    fingerprint: `live-guard-${index}`,
    productName: `Live Guard Product ${index}`,
    category: "Dry run guard",
  };
}

async function postJob(worker, env, jobId, sourceCandidates) {
  return worker.fetch(new Request("https://worker.test/jobs", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      projectId: "live-guard-project",
      sourceCandidates,
    }),
  }), env);
}

async function main() {
  const { default: worker, HandoverPipelineJob } = await loadWorkerModule();

  const disabledQueue = new QueueMock();
  const disabledEnv = {
    PIPELINE_MODE: "live_pilot",
    JOB_STATUS: new JobStatusNamespace(HandoverPipelineJob),
    SOURCE_ENRICHMENT_QUEUE: disabledQueue,
  };
  const disabledResponse = await postJob(worker, disabledEnv, "live-guard-disabled", [createCandidate(1)]);
  const disabled = await readJson(disabledResponse);
  assert(disabledResponse.status === 403, "Expected live pilot jobs to be rejected when disabled.");
  assert(disabled.safety?.livePilotEnabled === false, "Expected disabled safety state.");
  assert(disabledQueue.messages.length === 0, "Expected disabled live pilot to enqueue nothing.");

  const cappedQueue = new QueueMock();
  const cappedEnv = {
    PIPELINE_MODE: "live_pilot",
    LIVE_PILOT_ENABLED: "true",
    LIVE_PILOT_MAX_CANDIDATES: "1",
    JOB_STATUS: new JobStatusNamespace(HandoverPipelineJob),
    SOURCE_ENRICHMENT_QUEUE: cappedQueue,
  };
  const cappedResponse = await postJob(worker, cappedEnv, "live-guard-capped", [createCandidate(1), createCandidate(2)]);
  const capped = await readJson(cappedResponse);
  assert(cappedResponse.status === 413, "Expected live pilot candidate cap to reject oversized jobs.");
  assert(capped.safety?.livePilotMaxCandidates === 1, "Expected live pilot cap to be reported.");
  assert(cappedQueue.messages.length === 0, "Expected capped live pilot to enqueue nothing.");

  const unbudgetedQueue = new QueueMock();
  const unbudgetedEnv = {
    PIPELINE_MODE: "live_pilot",
    LIVE_PILOT_ENABLED: "true",
    LIVE_PILOT_MAX_CANDIDATES: "1",
    JOB_STATUS: new JobStatusNamespace(HandoverPipelineJob),
    SOURCE_ENRICHMENT_QUEUE: unbudgetedQueue,
  };
  const unbudgetedResponse = await postJob(worker, unbudgetedEnv, "live-guard-unbudgeted", [createCandidate(1)]);
  const unbudgeted = await readJson(unbudgetedResponse);
  assert(unbudgetedResponse.status === 403, "Expected live pilot admission to require explicit budgets.");
  assert(unbudgeted.safety?.livePilotBudget?.configured === false, "Expected missing budget state to be reported.");
  assert(unbudgetedQueue.messages.length === 0, "Expected unbudgeted live pilot to enqueue nothing.");

  const acceptedQueue = new QueueMock();
  const acceptedEnv = {
    PIPELINE_MODE: "live_pilot",
    LIVE_PILOT_ENABLED: "true",
    LIVE_PILOT_MAX_CANDIDATES: "1",
    LIVE_PILOT_MAX_SEARCHES: "2",
    LIVE_PILOT_MAX_ESTIMATED_COST_USD: "0.50",
    JOB_STATUS: new JobStatusNamespace(HandoverPipelineJob),
    SOURCE_ENRICHMENT_QUEUE: acceptedQueue,
  };
  const acceptedResponse = await postJob(worker, acceptedEnv, "live-guard-accepted", [createCandidate(1)]);
  const accepted = await readJson(acceptedResponse);
  assert(acceptedResponse.status === 202, "Expected one-candidate live pilot admission to be accepted.");
  assert(accepted.safety?.liveEnrichmentEnabled === false, "Expected live enrichment implementation to remain disabled.");
  assert(accepted.safety?.livePilotBudget?.configured === true, "Expected explicit live pilot budgets to be recorded.");
  assert(accepted.safety?.livePilotBudget?.maxSearches === 2, "Expected live pilot search budget to be recorded.");
  assert(accepted.safety?.livePilotBudget?.maxEstimatedCostUsd === 0.5, "Expected live pilot cost budget to be recorded.");
  assert(accepted.dryRunEnrichment === true, "Expected accepted live pilot admission to remain dry-run only.");
  assert(acceptedQueue.messages.length === 1, "Expected accepted live pilot admission to enqueue one dry-run message.");
  assert(acceptedQueue.messages[0].safety?.mode === "live_pilot", "Expected live pilot safety to be sent with the queue message.");
  assert(acceptedQueue.messages[0].safety?.livePilotBudget?.maxEstimatedCostUsd === 0.5, "Expected queue message to carry live pilot budget.");

  const acceptedStatus = await readJson(await worker.fetch(new Request("https://worker.test/jobs/live-guard-accepted"), acceptedEnv));
  assert(acceptedStatus.safety?.mode === "live_pilot", "Expected live pilot safety to persist in job status.");
  assert(acceptedStatus.safety?.livePilotBudget?.maxSearches === 2, "Expected job status to persist live pilot search budget.");

  console.log(JSON.stringify({
    ok: true,
    disabledStatus: disabledResponse.status,
    cappedStatus: cappedResponse.status,
    unbudgetedStatus: unbudgetedResponse.status,
    acceptedStatus: acceptedResponse.status,
    acceptedDryRunOnly: accepted.dryRunEnrichment === true && accepted.safety.liveEnrichmentEnabled === false,
    acceptedBudget: accepted.safety.livePilotBudget,
    persistedBudget: acceptedStatus.safety.livePilotBudget,
    queuedMessages: acceptedQueue.messages.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
