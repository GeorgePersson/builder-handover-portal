import { hasLlamaCloudConfig } from "@/lib/server/llamacloud";
import type { DocumentContextProvider } from "@/lib/server/document-context";

export type DocumentContextReadiness = {
  selectedProvider: DocumentContextProvider;
  requestedProvider: string;
  llamaCloudConfigured: boolean;
  willUseLlamaCloud: boolean;
  fallbackProvider: Extract<DocumentContextProvider, "local_pdf">;
  reasons: string[];
  checks: {
    envVar: "LLAMA_CLOUD_API_KEY";
    apiKeyPresent: boolean;
    providerEnvPresent: boolean;
    recognizedProvider: boolean;
  };
};

const llamaCloudProviderAliases = new Set(["llamacloud", "llamacloud_parse"]);
const localProviderAliases = new Set(["local_pdf", "local-pdf", "local"]);

function normalizeRequestedProvider(value: string | undefined) {
  return value?.trim().toLowerCase() || "auto";
}

export function getDocumentContextReadiness(): DocumentContextReadiness {
  const requestedProvider = normalizeRequestedProvider(process.env.DOCUMENT_CONTEXT_PROVIDER);
  const providerEnvPresent = requestedProvider !== "auto";
  const llamaCloudConfigured = hasLlamaCloudConfig();
  const reasons: string[] = [];
  let willUseLlamaCloud = false;
  let recognizedProvider = true;

  if (localProviderAliases.has(requestedProvider)) {
    reasons.push("DOCUMENT_CONTEXT_PROVIDER explicitly selects the local PDF/OCR fallback.");
  } else if (llamaCloudProviderAliases.has(requestedProvider)) {
    if (llamaCloudConfigured) {
      willUseLlamaCloud = true;
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud and LLAMA_CLOUD_API_KEY is present.");
    } else {
      reasons.push("DOCUMENT_CONTEXT_PROVIDER selects LlamaCloud, but LLAMA_CLOUD_API_KEY is missing, so uploads will fall back to local PDF/OCR.");
    }
  } else if (requestedProvider === "auto") {
    willUseLlamaCloud = llamaCloudConfigured;
    reasons.push(
      llamaCloudConfigured
        ? "DOCUMENT_CONTEXT_PROVIDER is unset; LLAMA_CLOUD_API_KEY is present, so uploads will try LlamaCloud first."
        : "DOCUMENT_CONTEXT_PROVIDER is unset and LLAMA_CLOUD_API_KEY is missing, so uploads will use local PDF/OCR.",
    );
  } else {
    recognizedProvider = false;
    reasons.push(`DOCUMENT_CONTEXT_PROVIDER=${requestedProvider} is not recognized; uploads will use local PDF/OCR.`);
  }

  if (!llamaCloudConfigured) {
    reasons.push("Set LLAMA_CLOUD_API_KEY to enable the LlamaCloud Parse path. Do not commit the key.");
  }

  return {
    selectedProvider: willUseLlamaCloud ? "llamacloud_parse" : "local_pdf",
    requestedProvider,
    llamaCloudConfigured,
    willUseLlamaCloud,
    fallbackProvider: "local_pdf",
    reasons,
    checks: {
      envVar: "LLAMA_CLOUD_API_KEY",
      apiKeyPresent: llamaCloudConfigured,
      providerEnvPresent,
      recognizedProvider,
    },
  };
}

export function shouldUseLlamaCloudProvider() {
  return getDocumentContextReadiness().willUseLlamaCloud;
}
