import type { ClientRequest, ExtractedHandoverItem } from "@/lib/types";

export function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function describeExtractedItemStatus(status: ExtractedHandoverItem["status"]) {
  const descriptions: Record<ExtractedHandoverItem["status"], string> = {
    proposed: "Waiting for triage",
    auto_approved: "Known database match",
    builder_approved: "Approved for this project only",
    admin_review: "Needs platform admin review",
    global_approved: "Reusable global record",
    accepted: "Legacy accepted item",
    edited: "Edited and waiting for review",
    rejected: "Rejected",
  };

  return descriptions[status];
}

export function describeClientRequestStatus(status: ClientRequest["status"]) {
  const descriptions: Record<ClientRequest["status"], string> = {
    submitted: "Submitted by client",
    ai_checking: "Sent to AI/admin review",
    admin_review: "Needs admin triage",
    builder_project_approved: "Approved for this project only",
    global_approved: "Approved into global database",
    rejected: "Rejected",
  };

  return descriptions[status];
}
