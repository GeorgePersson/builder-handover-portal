#!/usr/bin/env node
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const requestedProvider = process.env.DOCUMENT_CONTEXT_PROVIDER?.trim().toLowerCase() || "auto";
const apiKeyPresent = Boolean(process.env.LLAMA_CLOUD_API_KEY?.trim());
const llamaProviders = new Set(["llamacloud", "llamacloud_parse"]);
const localProviders = new Set(["local_pdf", "local-pdf", "local"]);

let selectedProvider = "local_pdf";
let recognizedProvider = true;
const reasons = [];

if (localProviders.has(requestedProvider)) {
  reasons.push("DOCUMENT_CONTEXT_PROVIDER explicitly selects local PDF/OCR fallback.");
} else if (llamaProviders.has(requestedProvider)) {
  if (apiKeyPresent) {
    selectedProvider = "llamacloud_parse";
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud and LLAMA_CLOUD_API_KEY is present.");
  } else {
    reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud, but LLAMA_CLOUD_API_KEY is missing; uploads will fall back to local PDF/OCR.");
  }
} else if (requestedProvider === "auto") {
  selectedProvider = apiKeyPresent ? "llamacloud_parse" : "local_pdf";
  reasons.push(apiKeyPresent
    ? "DOCUMENT_CONTEXT_PROVIDER is unset; LLAMA_CLOUD_API_KEY is present, so uploads will try LlamaCloud first."
    : "DOCUMENT_CONTEXT_PROVIDER is unset and LLAMA_CLOUD_API_KEY is missing, so uploads will use local PDF/OCR.");
} else {
  recognizedProvider = false;
  reasons.push(`DOCUMENT_CONTEXT_PROVIDER=${requestedProvider} is not recognized; uploads will use local PDF/OCR.`);
}

if (!apiKeyPresent) {
  reasons.push("Set LLAMA_CLOUD_API_KEY locally or in cloud hosting secrets to enable LlamaCloud. This check never prints the key.");
}

const report = {
  selectedProvider,
  requestedProvider,
  llamaCloudConfigured: apiKeyPresent,
  willUseLlamaCloud: selectedProvider === "llamacloud_parse",
  fallbackProvider: "local_pdf",
  checks: {
    envVar: "LLAMA_CLOUD_API_KEY",
    apiKeyPresent,
    providerEnvPresent: requestedProvider !== "auto",
    recognizedProvider,
  },
  reasons,
};

console.log(JSON.stringify(report, null, 2));

if (!recognizedProvider) {
  process.exitCode = 1;
}
