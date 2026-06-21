import { existsSync } from "node:fs";
import * as path from "node:path";
import { hasLlamaCloudConfig } from "@/lib/server/llamacloud";
import type { DocumentContextProvider } from "@/lib/server/document-context";

export type DocumentContextReadiness = {
  selectedProvider: DocumentContextProvider;
  requestedProvider: string;
  llamaCloudConfigured: boolean;
  doclingLocalConfigured: boolean;
  doclingHttpConfigured: boolean;
  willUseLlamaCloud: boolean;
  willUseDocling: boolean;
  fallbackProvider: Extract<DocumentContextProvider, "local_pdf">;
  reasons: string[];
  checks: {
    envVars: string[];
    llamaCloudApiKeyPresent: boolean;
    doclingScriptPresent: boolean;
    doclingServiceUrlPresent: boolean;
    providerEnvPresent: boolean;
    recognizedProvider: boolean;
  };
};

const llamaCloudProviderAliases = new Set(["llamacloud", "llamacloud_parse"]);
const doclingLocalProviderAliases = new Set(["docling", "docling_local", "docling-local"]);
const doclingHttpProviderAliases = new Set(["docling_http", "docling-http"]);
const localProviderAliases = new Set(["local_pdf", "local-pdf", "local"]);

function normalizeRequestedProvider(value: string | undefined) {
  return value?.trim().toLowerCase() || "auto";
}

function getDoclingScriptPath() {
  const configuredScript = process.env.DOCLING_SCRIPT?.trim();

  if (configuredScript) {
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredScript);
  }

  return path.join(process.cwd(), "scripts", "docling-convert.py");
}

export function getDocumentContextReadiness(): DocumentContextReadiness {
  const requestedProvider = normalizeRequestedProvider(process.env.DOCUMENT_CONTEXT_PROVIDER);
  const providerEnvPresent = requestedProvider !== "auto";
  const llamaCloudConfigured = hasLlamaCloudConfig();
  const doclingLocalConfigured = existsSync(getDoclingScriptPath());
  const doclingHttpConfigured = Boolean(process.env.DOCLING_SERVICE_URL?.trim());
  const reasons: string[] = [];
  let selectedProvider: DocumentContextProvider = "local_pdf";
  let recognizedProvider = true;

  if (localProviderAliases.has(requestedProvider)) {
    reasons.push("DOCUMENT_CONTEXT_PROVIDER explicitly selects the local PDF/OCR fallback.");
  } else if (doclingLocalProviderAliases.has(requestedProvider)) {
    if (doclingLocalConfigured) {
      selectedProvider = "docling_local";
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects local Docling and scripts/docling-convert.py is present.");
    } else {
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects local Docling, but the Docling converter script is missing, so uploads will fall back to local PDF/OCR.");
    }
  } else if (doclingHttpProviderAliases.has(requestedProvider)) {
    if (doclingHttpConfigured) {
      selectedProvider = "docling_http";
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects Docling HTTP and DOCLING_SERVICE_URL is present.");
    } else {
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects Docling HTTP, but DOCLING_SERVICE_URL is missing, so uploads will fall back to local PDF/OCR.");
    }
  } else if (llamaCloudProviderAliases.has(requestedProvider)) {
    if (llamaCloudConfigured) {
      selectedProvider = "llamacloud_parse";
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud and LLAMA_CLOUD_API_KEY is present.");
    } else {
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud, but LLAMA_CLOUD_API_KEY is missing, so uploads will fall back to local PDF/OCR.");
    }
  } else if (requestedProvider === "auto") {
    selectedProvider = llamaCloudConfigured ? "llamacloud_parse" : "local_pdf";
    reasons.push(
      llamaCloudConfigured
        ? "DOCUMENT_CONTEXT_PROVIDER is unset; LLAMA_CLOUD_API_KEY is present, so uploads will try LlamaCloud first."
        : "DOCUMENT_CONTEXT_PROVIDER is unset and LLAMA_CLOUD_API_KEY is missing, so uploads will use local PDF/OCR.",
    );
  } else {
    recognizedProvider = false;
    reasons.push(`DOCUMENT_CONTEXT_PROVIDER=${requestedProvider} is not recognized; uploads will use local PDF/OCR.`);
  }

  if (!doclingLocalConfigured) {
    reasons.push("Add scripts/docling-convert.py and install Docling locally to enable DOCUMENT_CONTEXT_PROVIDER=docling_local.");
  }

  if (!llamaCloudConfigured) {
    reasons.push("Set LLAMA_CLOUD_API_KEY to enable the LlamaCloud Parse path. Do not commit the key.");
  }

  return {
    selectedProvider,
    requestedProvider,
    llamaCloudConfigured,
    doclingLocalConfigured,
    doclingHttpConfigured,
    willUseLlamaCloud: selectedProvider === "llamacloud_parse",
    willUseDocling: selectedProvider === "docling_local" || selectedProvider === "docling_http",
    fallbackProvider: "local_pdf",
    reasons,
    checks: {
      envVars: ["DOCUMENT_CONTEXT_PROVIDER", "LLAMA_CLOUD_API_KEY", "DOCLING_PYTHON", "DOCLING_SCRIPT", "DOCLING_SERVICE_URL"],
      llamaCloudApiKeyPresent: llamaCloudConfigured,
      doclingScriptPresent: doclingLocalConfigured,
      doclingServiceUrlPresent: doclingHttpConfigured,
      providerEnvPresent,
      recognizedProvider,
    },
  };
}

export function shouldUseLlamaCloudProvider() {
  return getDocumentContextReadiness().selectedProvider === "llamacloud_parse";
}

export function shouldUseDoclingLocalProvider() {
  return getDocumentContextReadiness().selectedProvider === "docling_local";
}
