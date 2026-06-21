import { NextResponse } from "next/server";
import { getDocumentContextReadiness } from "@/lib/server/document-context-readiness";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getDocumentContextReadiness());
}
