import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const maxPdfSizeBytes = 30 * 1024 * 1024;
const maxDocumentSizeBytes = 50 * 1024 * 1024;
const allowedProjectDocumentExtensions = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
  ".xls",
  ".xlsx",
]);
const allowedProjectDocumentMimeTypes = new Set([
  "application/csv",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
]);

export async function prepareSpecificationPdf(formData: FormData) {
  const file = formData.get("specificationPdf");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Specification upload must be a PDF.");
  }

  if (file.size > maxPdfSizeBytes) {
    throw new Error("Specification PDF must be 30 MB or smaller.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `specifications/${Date.now()}-${safeName}`;

  return {
    bytes,
    fileName: file.name,
    safeName,
    size: file.size,
    storagePath,
    type: file.type || "application/pdf",
  };
}

export async function prepareProjectDocument(formData: FormData) {
  const file = formData.get("documentFile");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (file.size > maxDocumentSizeBytes) {
    throw new Error("Project document must be 50 MB or smaller.");
  }

  const extension = path.extname(file.name).toLowerCase();
  const hasAllowedExtension = allowedProjectDocumentExtensions.has(extension);
  const hasAllowedMimeType = file.type ? allowedProjectDocumentMimeTypes.has(file.type) : false;

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    throw new Error("Project document type is not supported.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `documents/${Date.now()}-${safeName}`;

  return {
    bytes,
    fileType: extension.replace(".", "") || "file",
    fileName: file.name,
    safeName,
    size: file.size,
    storagePath,
    type: file.type || "application/octet-stream",
  };
}

export async function saveLocalUpload(storagePath: string, bytes: Buffer) {
  const uploadRoot = path.join(process.cwd(), ".local-uploads");
  const targetPath = path.join(uploadRoot, storagePath);
  const resolvedRoot = path.resolve(uploadRoot);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error("Invalid upload path.");
  }

  await mkdir(path.dirname(resolvedTarget), { recursive: true });
  await writeFile(resolvedTarget, bytes);
  return resolvedTarget;
}
