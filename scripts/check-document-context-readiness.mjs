#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const requestedProvider = process.env.DOCUMENT_CONTEXT_PROVIDER?.trim().toLowerCase() || "auto";
const llamaApiKeyPresent = Boolean(process.env.LLAMA_CLOUD_API_KEY?.trim());
const doclingScriptPath = path.resolve(process.cwd(), process.env.DOCLING_SCRIPT?.trim() || path.join("scripts", "docling-convert.py"));
const doclingScriptPresent = fs.existsSync(doclingScriptPath);
const doclingServiceUrlPresent = Boolean(process.env.DOCLING_SERVICE_URL?.trim());
const llamaProviders = new Set(["llamacloud", "llamacloud_parse"]);
const doclingLocalProviders = new Set(["docling", "docling_local", "docling-local"]);
const doclingHttpProviders = new Set(["docling_http", "docling-http"]);
const localProviders = new Set(["local_pdf", "local-pdf", "local"]);

let selectedProvider = "local_pdf";
let recognizedProvider = true;
const reasons = [];

if (localProviders.has(requestedProvider)) {
  reasons.push("DOCUMENT_CONTEXT_PROVIDER explicitly selects local PDF/OCR fallback.");
} else if (doclingLocalProviders.has(requestedProvider)) {
  if (doclingScriptPresent) {
    selectedProvider = "docling_local";
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects local Docling and scripts/docling-convert.py is present.");
  } else {
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects local Docling, but the converter script is missing; uploads will fall back to local PDF/OCR.");
  }
} else if (doclingHttpProviders.has(requestedProvider)) {
  if (doclingServiceUrlPresent) {
    selectedProvider = "docling_http";
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects Docling HTTP and DOCLING_SERVICE_URL is present.");
  } else {
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects Docling HTTP, but DOCLING_SERVICE_URL is missing; uploads will fall back to local PDF/OCR.");
  }
} else if (llamaProviders.has(requestedProvider)) {
  if (llamaApiKeyPresent) {
    selectedProvider = "llamacloud_parse";
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud and LLAMA_CLOUD_API_KEY is present.");
  } else {
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud, but LLAMA_CLOUD_API_KEY is missing; uploads will fall back to local PDF/OCR.");
  }
} else if (requestedProvider === "auto") {
  selectedProvider = llamaApiKeyPresent ? "llamacloud_parse" : "local_pdf";
  reasons.push(llamaApiKeyPresent
    ? "DOCUMENT_CONTEXT_PROVIDER is unset; LLAMA_CLOUD_API_KEY is present, so uploads will try LlamaCloud first."
    : "DOCUMENT_CONTEXT_PROVIDER is unset and LLAMA_CLOUD_API_KEY is missing, so uploads will use local PDF/OCR.");
} else {
  recognizedProvider = false;
  reasons.push(`DOCUMENT_CONTEXT_PROVIDER=${requestedProvider} is not recognized; uploads will use local PDF/OCR.`);
}

if (!doclingScriptPresent) {
  reasons.push("Add scripts/docling-convert.py and install Docling locally to enable DOCUMENT_CONTEXT_PROVIDER=docling_local.");
}

if (!llamaApiKeyPresent) {
  reasons.push("Set LLAMA_CLOUD_API_KEY locally or in cloud hosting secrets to enable LlamaCloud. This check never prints the key.");
}

const report = {
  selectedProvider,
  requestedProvider,
  llamaCloudConfigured: llamaApiKeyPresent,
  doclingLocalConfigured: doclingScriptPresent,
  doclingHttpConfigured: doclingServiceUrlPresent,
  willUseLlamaCloud: selectedProvider === "llamacloud_parse",
  willUseDocling: selectedProvider === "docling_local" || selectedProvider === "docling_http",
  fallbackProvider: "local_pdf",
  checks: {
    envVars: ["DOCUMENT_CONTEXT_PROVIDER", "LLAMA_CLOUD_API_KEY", "DOCLING_PYTHON", "DOCLING_SCRIPT", "DOCLING_SERVICE_URL"],
    llamaCloudApiKeyPresent: llamaApiKeyPresent,
    doclingScriptPresent,
    doclingServiceUrlPresent,
    providerEnvPresent: requestedProvider !== "auto",
    recognizedProvider,
  },
  reasons,
};

console.log(JSON.stringify(report, null, 2));

if (!recognizedProvider) {
  process.exitCode = 1;
}
