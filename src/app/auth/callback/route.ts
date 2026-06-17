import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/builder/projects";
  }

  return value;
}

function getLoginRedirect(request: NextRequest, error: string, next: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeNext(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return getLoginRedirect(request, "callback-missing-code", next);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase auth callback failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });

    return getLoginRedirect(request, "callback-failed", next);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
