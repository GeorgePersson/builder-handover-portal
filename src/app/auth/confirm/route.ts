import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNext(request: NextRequest, value: string | null): string {
  if (!value) {
    return "/builder/projects";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);

    if (url.pathname === "/auth/callback") {
      return getSafeNext(request, url.searchParams.get("next"));
    }

    if (url.origin === request.nextUrl.origin) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return "/builder/projects";
  }

  return "/builder/projects";
}

function getLoginRedirect(request: NextRequest, error: string, next: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNext(
    request,
    request.nextUrl.searchParams.get("next") ||
      request.nextUrl.searchParams.get("callback") ||
      request.nextUrl.searchParams.get("redirect_to"),
  );

  if (!tokenHash || !type) {
    return getLoginRedirect(request, "confirm-missing-token", next);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("Supabase token hash verification failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });

    return getLoginRedirect(request, "confirm-failed", next);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
